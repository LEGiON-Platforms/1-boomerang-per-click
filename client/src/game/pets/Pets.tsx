import { useFrame } from '@react-three/fiber'
import {
  decodePublicPet,
  MAX_CLIENTS,
  PET_BY_ID,
  type PetShape,
  PETS_CONFIG,
  type PlayerData,
  rarityIndex,
} from '@game/shared'
import { useEffect, useMemo } from 'react'
import { Color, InstancedBufferAttribute, InstancedMesh, type Material, Matrix4, Object3D, Vector3 } from 'three'

import { remoteList } from '../../net/remote'
import { game } from '../../state/gameStore'
import { useQuality } from '../../state/qualityStore'
import { createTwoToneMaterial } from '../assets'
import { localPlayer, now } from '../runtime'
import { getPetGeometry, PET_SHAPES } from './petGeometry'

/**
 * Every player's equipped pets, floating behind their owner: one instanced draw
 * call per body shape (7 max) with a shared two-tone material.
 */
const MAX_PETS = MAX_CLIENTS * PETS_CONFIG.maxSlots
const HIDDEN = new Matrix4().makeScale(0, 0, 0)
const GOLD = new Color('#ffd23f')
const GLOW_BY_RARITY = [0, 0, 0.04, 0.1, 0.2, 0.35]
const SCALE_BY_RARITY = [0.8, 0.85, 0.9, 1.0, 1.1, 1.22]

interface PetLook {
  shape: PetShape
  body: Color
  accent: Color
  rarity: number
  golden: boolean
}

const looks = new Map<string, { body: Color; accent: Color; shape: PetShape }>()
function lookOf(petId: string) {
  let l = looks.get(petId)
  if (!l) {
    const def = PET_BY_ID[petId]
    l = { body: new Color(def?.color ?? '#ffffff'), accent: new Color(def?.accent ?? '#888888'), shape: def?.shape ?? 'bear' }
    looks.set(petId, l)
  }
  return l
}

/** Decoded pet lists, cached by the source array's identity (no per-frame parsing). */
const remoteCache = new WeakMap<string[], PetLook[]>()
function remotePets(list: string[]): PetLook[] {
  let out = remoteCache.get(list)
  if (!out) {
    out = list.map((s) => {
      const p = decodePublicPet(s)
      const l = lookOf(p.petId)
      return { shape: l.shape, body: p.golden ? GOLD : l.body, accent: l.accent, rarity: p.rarity, golden: p.golden }
    })
    remoteCache.set(list, out)
  }
  return out
}
const localCache = new WeakMap<PlayerData, PetLook[]>()
function localPets(d: PlayerData): PetLook[] {
  let out = localCache.get(d)
  if (!out) {
    const byUid = new Map(d.pets.map((p) => [p.uid, p]))
    out = []
    for (const uid of d.equippedPets) {
      const p = byUid.get(uid)
      if (!p) continue
      const l = lookOf(p.petId)
      out.push({ shape: l.shape, body: p.golden ? GOLD : l.body, accent: l.accent, rarity: rarityIndex(p.rarity), golden: p.golden })
    }
    localCache.set(d, out)
  }
  return out
}

/** Everything the frame loop writes into, created once per mount. */
interface PetScene {
  meshes: Record<PetShape, InstancedMesh>
  accent: Record<PetShape, InstancedBufferAttribute>
  glow: Record<PetShape, InstancedBufferAttribute>
  counts: Record<PetShape, number>
  /** Smoothed world positions, one per (owner, slot). */
  positions: Vector3[]
}

const _o = new Object3D()
const _t = new Vector3()

function placePets(scene: PetScene, owner: number, list: PetLook[], ox: number, oy: number, oz: number, rot: number, t: number, dt: number): void {
  const n = Math.min(list.length, PETS_CONFIG.maxSlots)
  for (let i = 0; i < n; i += 1) {
    const pet = list[i]
    const mesh = scene.meshes[pet.shape]
    const angle = rot + Math.PI + (i - (n - 1) / 2) * 0.6
    const radius = 1.8 + (i % 2) * 0.5
    _t.set(ox + Math.sin(angle) * radius, oy + 1.2 + Math.sin(t * 3 + i * 1.7) * 0.18, oz + Math.cos(angle) * radius)
    const p = scene.positions[owner * PETS_CONFIG.maxSlots + i]
    if (p.y < -50) p.copy(_t)
    else p.lerp(_t, 1 - Math.exp(-6 * dt))
    _o.position.copy(p)
    _o.rotation.set(0, rot + Math.sin(t * 2 + i) * 0.2, Math.sin(t * 2.4 + i) * 0.08)
    _o.scale.setScalar(SCALE_BY_RARITY[pet.rarity] * (pet.golden ? 1.1 : 1))
    _o.updateMatrix()
    const k = scene.counts[pet.shape]
    mesh.setMatrixAt(k, _o.matrix)
    mesh.setColorAt(k, pet.body)
    scene.accent[pet.shape].setXYZ(k, pet.accent.r, pet.accent.g, pet.accent.b)
    scene.glow[pet.shape].setX(k, GLOW_BY_RARITY[pet.rarity] + (pet.golden ? 0.2 : 0))
    scene.counts[pet.shape] = k + 1
  }
}

function createPetScene(material: Material): PetScene {
  const meshes = {} as Record<PetShape, InstancedMesh>
  const accent = {} as Record<PetShape, InstancedBufferAttribute>
  const glow = {} as Record<PetShape, InstancedBufferAttribute>
  const counts = {} as Record<PetShape, number>
  for (const shape of PET_SHAPES) {
    const geometry = getPetGeometry(shape).clone()
    accent[shape] = new InstancedBufferAttribute(new Float32Array(MAX_PETS * 3), 3)
    glow[shape] = new InstancedBufferAttribute(new Float32Array(MAX_PETS), 1)
    geometry.setAttribute('instanceAccent', accent[shape])
    geometry.setAttribute('instanceGlow', glow[shape])
    meshes[shape] = new InstancedMesh(geometry, material, MAX_PETS)
    meshes[shape].castShadow = true
    meshes[shape].frustumCulled = false
    for (let i = 0; i < MAX_PETS; i += 1) meshes[shape].setMatrixAt(i, HIDDEN)
    // Create instanceColor up front so the shader compiles with it once.
    meshes[shape].setColorAt(0, GOLD)
    counts[shape] = 0
  }
  return { meshes, accent, glow, counts, positions: Array.from({ length: MAX_PETS }, () => new Vector3(0, -100, 0)) }
}

export function Pets() {
  const remoteAllowed = useQuality((s) => s.settings.remotePets)
  const hideOthers = useQuality((s) => s.hideOtherPets)
  const showRemote = remoteAllowed && !hideOthers

  const material = useMemo(createTwoToneMaterial, [])
  const scene = useMemo(() => createPetScene(material), [material])

  useEffect(
    () => () => {
      for (const shape of PET_SHAPES) scene.meshes[shape].geometry.dispose()
      material.dispose()
    },
    [scene, material],
  )

  useFrame((_s, delta) => {
    const t = now()
    const dt = Math.min(delta, 0.05)
    for (let s = 0; s < PET_SHAPES.length; s += 1) scene.counts[PET_SHAPES[s]] = 0

    const data = game().data
    const lp = localPlayer.pos
    if (data) placePets(scene, 0, localPets(data), lp.x, lp.y, lp.z, localPlayer.rotY, t, dt)
    if (showRemote) {
      for (let r = 0; r < remoteList.length && r < MAX_CLIENTS - 1; r += 1) {
        const rp = remoteList[r]
        placePets(scene, r + 1, remotePets(rp.pets), rp.px, rp.py, rp.pz, rp.prot, t, dt)
      }
    }

    for (let s = 0; s < PET_SHAPES.length; s += 1) {
      const shape = PET_SHAPES[s]
      const mesh = scene.meshes[shape]
      mesh.count = scene.counts[shape]
      mesh.visible = mesh.count > 0
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      scene.accent[shape].needsUpdate = true
      scene.glow[shape].needsUpdate = true
    }
  })

  return (
    <>
      {PET_SHAPES.map((shape) => (
        <primitive key={shape} object={scene.meshes[shape]} />
      ))}
    </>
  )
}

export default Pets
