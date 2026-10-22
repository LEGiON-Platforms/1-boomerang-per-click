import { useFrame } from '@react-three/fiber'
import { MAX_CLIENTS, PEDESTAL_SPOTS } from '@game/shared'
import { useEffect, useMemo, useRef } from 'react'
import { Color, type InstancedBufferAttribute, type InstancedMesh, Matrix4, Object3D, Vector3 } from 'three'

import { remoteList } from '../../net/remote'
import { game } from '../../state/gameStore'
import { attachGlowAttribute, createGlowInstancedMaterial, getBoomerangGeometry } from '../assets'
import { pedestalStart } from '../lobby/LobbySigns'
import { now } from '../runtime'
import { boomerangLook, PROJECTILE_CAPACITY, projectilePosition, projectiles, stepProjectiles } from './projectiles'

/**
 * Every boomerang except the local player's held one, in ONE instanced draw call:
 * the lobby pedestal display, other players' held boomerangs and all boomerangs in
 * flight. Each system owns a fixed slot range; unused slots are scaled to zero.
 */
const PEDESTAL_SLOTS = PEDESTAL_SPOTS.length
const REMOTE_SLOTS = MAX_CLIENTS
const PEDESTAL_BASE = 0
const REMOTE_BASE = PEDESTAL_BASE + PEDESTAL_SLOTS
const FLIGHT_BASE = REMOTE_BASE + REMOTE_SLOTS
const CAPACITY = FLIGHT_BASE + PROJECTILE_CAPACITY

const HIDDEN = new Matrix4().makeScale(0, 0, 0)
const _o = new Object3D()
const _p = new Vector3()
const _c = new Color()

function place(mesh: InstancedMesh, glow: InstancedBufferAttribute, slot: number, color: number, g: number): void {
  _o.updateMatrix()
  mesh.setMatrixAt(slot, _o.matrix)
  mesh.setColorAt(slot, _c.setHex(color))
  glow.setX(slot, g)
}

export function BoomerangInstances() {
  const ref = useRef<InstancedMesh>(null)
  const glowRef = useRef<InstancedBufferAttribute | null>(null)
  const material = useMemo(createGlowInstancedMaterial, [])
  const geometry = useMemo(() => getBoomerangGeometry().clone(), [])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    glowRef.current = attachGlowAttribute(mesh, CAPACITY)
    for (let i = 0; i < CAPACITY; i += 1) {
      mesh.setMatrixAt(i, HIDDEN)
      mesh.setColorAt(i, _c.setHex(0xffffff))
    }
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame((_s, delta) => {
    const mesh = ref.current
    const glow = glowRef.current
    if (!mesh || !glow) return
    const t = now()
    stepProjectiles(Math.min(delta, 0.05))

    // Pedestal display: best owned + the next five, spinning above the pedestals.
    const data = game().data
    const start = pedestalStart(data?.boomerangsOwned ?? 1)
    for (let i = 0; i < PEDESTAL_SLOTS; i += 1) {
      const spot = PEDESTAL_SPOTS[i]
      const look = boomerangLook(start + i, false)
      _o.position.set(spot.x, 2.3 + Math.sin(t * 2 + i) * 0.15, spot.z)
      _o.rotation.set(0.3, t * 1.4 + i, 0)
      _o.scale.setScalar(1.3)
      place(mesh, glow, PEDESTAL_BASE + i, look.hex, look.glow)
    }

    // Other players' held boomerangs, at their right hand (raised mid-throw).
    let r = 0
    for (; r < remoteList.length && r < REMOTE_SLOTS; r += 1) {
      const p = remoteList[r]
      const look = boomerangLook(p.boomerang, p.vip)
      const throwing = t - p.throwAt < 0.38
      _o.position.set(
        p.px - Math.cos(p.prot) * 0.62 + Math.sin(p.prot) * 0.15,
        p.py + (throwing ? 2.1 : 1.15),
        p.pz + Math.sin(p.prot) * 0.62 + Math.cos(p.prot) * 0.15,
      )
      _o.rotation.set(Math.PI / 2 - 0.4, p.prot + Math.PI / 2, 0)
      _o.scale.setScalar(0.62)
      place(mesh, glow, REMOTE_BASE + r, look.hex, look.glow)
    }
    for (; r < REMOTE_SLOTS; r += 1) mesh.setMatrixAt(REMOTE_BASE + r, HIDDEN)

    // Boomerangs in flight, spinning flat along their arc.
    for (let i = 0; i < PROJECTILE_CAPACITY; i += 1) {
      const pr = projectiles[i]
      if (!pr.active) {
        mesh.setMatrixAt(FLIGHT_BASE + i, HIDDEN)
        continue
      }
      _o.position.copy(projectilePosition(pr, _p))
      _o.rotation.set(0, pr.t * Math.PI * 9, 0.15)
      _o.scale.setScalar(0.75)
      place(mesh, glow, FLIGHT_BASE + i, pr.color, pr.glow)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    glow.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[geometry, material, CAPACITY]} castShadow frustumCulled={false} />
}

export default BoomerangInstances
