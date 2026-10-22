import { useFrame } from '@react-three/fiber'
import { BOOMERANG_SPOTS, bestBoomerangId, MAX_CLIENTS, VIP_DISPLAY } from '@game/shared'
import { useEffect, useMemo } from 'react'
import {
  type BufferGeometry,
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  type MeshStandardMaterial,
  Euler,
  Object3D,
  Quaternion,
  Vector3,
} from 'three'

import { remoteList } from '../../net/remote'
import { game } from '../../state/gameStore'
import { type Preset, useQuality } from '../../state/qualityStore'
import { buildBoomerangGeometry, createBoomerangMaterial, holdPose, setBoomerangTime } from '../boomerangModel'
import { type BoomerangLook, boomerangLook, SHAPE_KEYS } from '../boomerangShapes'
import { displayStart, isBackRow } from '../lobby/boomerangDisplay'
import { heldBoomerang, localPlayer, now, THROW_ANIM_S, throwFlatness } from '../runtime'
import { PROJECTILE_CAPACITY, projectilePosition, projectiles, stepProjectiles } from './projectiles'

/**
 * Every boomerang in the world — the Boomerang Stage display, the local player's
 * held one, other players' held ones and all boomerangs in flight — drawn with
 * one InstancedMesh per silhouette (≤ 6 draw calls). Instances are packed from
 * slot 0 each frame; a shape with nothing to draw is skipped entirely.
 */
const CAPACITY = BOOMERANG_SPOTS.length + 1 + 1 + MAX_CLIENTS + PROJECTILE_CAPACITY

/** The stairs display is skipped once the player is this far down the stage corridor. */
const DISPLAY_CULL_Z = -30

const _o = new Object3D()
const _p = new Vector3()
const _v = new Vector3()
const _c = new Color()
const _e = new Euler()
const _qa = new Quaternion()
const _qb = new Quaternion()
const _qc = new Quaternion()
const Y_AXIS = new Vector3(0, 1, 0)
const Z_AXIS = new Vector3(0, 0, 1)

const HELD_SCALE = 0.8
/** Bank of a thrown boomerang's spin plane from flat (radians): it flies like a frisbee. */
const FLIGHT_BANK = 0.28
/** Spin over one out-and-back flight (radians). */
const FLIGHT_SPIN = Math.PI * 14
const HOLD_POSES = SHAPE_KEYS.map(holdPose)

/**
 * Poses `_o` as a boomerang held at `hand` by a player facing `yaw`: stood up
 * facing forward, rolled so it rises from the grip beside the shoulder, and
 * shifted so the grip tip sits in the hand.
 */
function poseHeld(hand: Vector3, yaw: number, look: BoomerangLook, flat: number): void {
  const hold = HOLD_POSES[look.shapeIndex]
  _qa.setFromEuler(_e.set(Math.PI / 2, yaw, hold.roll, 'YZX'))
  if (flat > 0) {
    // Mid throw it turns flat, like a frisbee about to be released.
    _qb.setFromEuler(_e.set(0, yaw + hold.flatYaw, 0, 'XYZ'))
    _o.quaternion.slerpQuaternions(_qa, _qb, flat)
  } else _o.quaternion.copy(_qa)
  _o.scale.setScalar(HELD_SCALE)
  _v.copy(hold.grip).multiplyScalar(HELD_SCALE).applyQuaternion(_o.quaternion)
  _o.position.copy(hand).sub(_v)
}

class BoomerangSet {
  readonly group = new Group()
  readonly meshes: InstancedMesh[]
  private readonly materials: MeshStandardMaterial[]
  private readonly accents: InstancedBufferAttribute[]
  private readonly looks: InstancedBufferAttribute[]
  /** Look last written to each slot, so unchanged slots skip the colour writes. */
  private readonly slotLook: (BoomerangLook | null)[][]
  private readonly counts = new Int32Array(SHAPE_KEYS.length)
  private readonly dirty = new Uint8Array(SHAPE_KEYS.length)
  private preset: Preset | null = null

  constructor(preset: Preset) {
    this.materials = SHAPE_KEYS.map(createBoomerangMaterial)
    this.accents = SHAPE_KEYS.map(() => new InstancedBufferAttribute(new Float32Array(CAPACITY * 3), 3))
    this.looks = SHAPE_KEYS.map(() => new InstancedBufferAttribute(new Float32Array(CAPACITY * 2), 2))
    this.slotLook = SHAPE_KEYS.map(() => new Array<BoomerangLook | null>(CAPACITY).fill(null))
    this.meshes = SHAPE_KEYS.map((_shape, s) => {
      const mesh = new InstancedMesh(this.geometry(s, preset), this.materials[s], CAPACITY)
      mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(CAPACITY * 3), 3)
      mesh.castShadow = true
      mesh.frustumCulled = false
      mesh.count = 0
      mesh.visible = false
      this.group.add(mesh)
      return mesh
    })
    this.preset = preset
  }

  /** Geometry for shape `s` at the preset's detail, wired to the shared per-instance attributes. */
  private geometry(s: number, preset: Preset): BufferGeometry {
    const geo = buildBoomerangGeometry(SHAPE_KEYS[s], preset)
    geo.setAttribute('instanceAccent', this.accents[s])
    geo.setAttribute('instanceLook', this.looks[s])
    return geo
  }

  /** Rebuilds the geometries at the preset's level of detail. */
  setPreset(preset: Preset): void {
    if (preset === this.preset) return
    this.preset = preset
    this.meshes.forEach((mesh, s) => {
      const old = mesh.geometry
      mesh.geometry = this.geometry(s, preset)
      old.dispose()
    })
  }

  begin(): void {
    this.counts.fill(0)
  }

  /** Adds one boomerang posed by `_o` (matrix updated here). */
  add(look: BoomerangLook): void {
    const s = look.shapeIndex
    const i = this.counts[s]
    if (i >= CAPACITY) return
    this.counts[s] = i + 1
    const mesh = this.meshes[s]
    _o.updateMatrix()
    mesh.setMatrixAt(i, _o.matrix)
    if (this.slotLook[s][i] !== look) {
      this.slotLook[s][i] = look
      mesh.setColorAt(i, _c.setHex(look.hex))
      _c.setHex(look.accentHex)
      this.accents[s].setXYZ(i, _c.r, _c.g, _c.b)
      this.looks[s].setXY(i, look.glow, look.style)
      this.dirty[s] = 1
    }
  }

  end(): void {
    for (let s = 0; s < this.meshes.length; s += 1) {
      const mesh = this.meshes[s]
      const n = this.counts[s]
      mesh.count = n
      mesh.visible = n > 0
      if (n === 0) continue
      // Whole-buffer upload (≤ 55 matrices): update ranges would allocate every frame.
      mesh.instanceMatrix.needsUpdate = true
      if (this.dirty[s]) {
        this.dirty[s] = 0
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
        this.accents[s].needsUpdate = true
        this.looks[s].needsUpdate = true
      }
    }
  }

  dispose(): void {
    for (const mesh of this.meshes) mesh.geometry.dispose()
    for (const m of this.materials) m.dispose()
  }
}

export function BoomerangInstances() {
  const preset = useQuality((s) => s.preset)
  // Built once; a preset change only swaps the geometries.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const set = useMemo(() => new BoomerangSet(preset), [])
  useEffect(() => set.setPreset(preset), [set, preset])
  useEffect(() => () => set.dispose(), [set])

  useFrame((_s, delta) => {
    const t = now()
    stepProjectiles(Math.min(delta, 0.05))
    setBoomerangTime(t)
    set.begin()

    // Boomerang Stage: one big boomerang standing over each buy pad (the back row
    // floating higher), turning slowly to face the lobby, and the VIP one on its podium.
    const data = game().data
    if (localPlayer.pos.z > DISPLAY_CULL_Z) {
      const start = displayStart(data?.boomerangsOwned ?? 1)
      for (let i = 0; i < BOOMERANG_SPOTS.length; i += 1) {
        const spot = BOOMERANG_SPOTS[i]
        _o.position.set(spot.x, spot.y + (isBackRow(i) ? 5.6 : 2.2) + Math.sin(t * 2 + i) * 0.15, spot.z)
        _o.rotation.set(Math.PI / 2 - 0.2, -Math.PI / 2 + Math.sin(t * 0.8 + i) * 0.6, 0, 'YXZ')
        _o.scale.setScalar(1.6)
        set.add(boomerangLook(start + i))
      }
      _o.position.set(VIP_DISPLAY.x, VIP_DISPLAY.y + 3.2 + Math.sin(t * 1.6) * 0.2, VIP_DISPLAY.z)
      _o.rotation.set(Math.PI / 2 - 0.2, -Math.PI / 2 + t * 0.9, 0, 'YXZ')
      _o.scale.setScalar(2.6)
      set.add(boomerangLook(0, true))
    }

    // The local player's held boomerang, gripped by its tip at the right hand
    // (LocalPlayer tracks the hand; the arm pose does the wind-up and release).
    const held = heldBoomerang
    if (held.visible && data) {
      const look = boomerangLook(bestBoomerangId(data), data.vipBoomerang)
      poseHeld(held.position, held.yaw, look, held.flat)
      set.add(look)
    }

    // Other players' held boomerangs: same grip at an estimated hand (raised mid-throw).
    for (let r = 0; r < remoteList.length && r < MAX_CLIENTS; r += 1) {
      const p = remoteList[r]
      const throwing = t - p.throwAt < THROW_ANIM_S
      _p.set(
        p.px - Math.cos(p.prot) * 0.62 + Math.sin(p.prot) * 0.3,
        p.py + (throwing ? 2.1 : 1.35),
        p.pz + Math.sin(p.prot) * 0.62 + Math.cos(p.prot) * 0.3,
      )
      const look = boomerangLook(p.boomerang, p.vip)
      poseHeld(_p, p.prot, look, throwing ? throwFlatness((t - p.throwAt) / THROW_ANIM_S) : 0)
      set.add(look)
    }

    // Boomerangs in flight: thrown flat, spinning fast in a horizontal circle along
    // their curved out-and-back path, banked a little into the turn.
    for (let i = 0; i < PROJECTILE_CAPACITY; i += 1) {
      const pr = projectiles[i]
      if (!pr.active) continue
      _o.position.copy(projectilePosition(pr, _p))
      const heading = Math.atan2(pr.to.x - pr.from.x, pr.to.z - pr.from.z)
      _qa.setFromAxisAngle(Y_AXIS, heading)
      _qb.setFromAxisAngle(Z_AXIS, FLIGHT_BANK)
      _qc.setFromAxisAngle(Y_AXIS, pr.t * FLIGHT_SPIN)
      _o.quaternion.copy(_qa).multiply(_qb).multiply(_qc)
      _o.scale.setScalar(0.8)
      set.add(pr.look)
    }

    set.end()
  })

  return <primitive object={set.group} />
}

export default BoomerangInstances
