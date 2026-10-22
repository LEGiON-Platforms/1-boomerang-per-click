import { useFrame } from '@react-three/fiber'
import { hashString, MAX_CLIENTS } from '@game/shared'
import { useEffect, useMemo, useRef } from 'react'
import { BoxGeometry, Color, type InstancedMesh, Matrix4, MeshLambertMaterial, Object3D } from 'three'

import { remoteList, sampleRemote } from '../../net/remote'
import { now, THROW_ANIM_S } from '../runtime'

/**
 * Other players as blocky avatars — head, torso, two arms, two legs — all players'
 * parts in ONE instanced draw call. The nearest few are drawn as their real Bloxity
 * avatars instead (RemoteAvatars; ~6 draw calls each, so the count is capped per
 * quality preset); their blocky slots are hidden.
 */
const PARTS = 6
const CAPACITY = (MAX_CLIENTS - 1) * PARTS
const HIDDEN = new Matrix4().makeScale(0, 0, 0)
const SHIRTS = [0xe8323c, 0x2f8cff, 0x2ee66b, 0xffb31a, 0xb04dff, 0x1b1b22, 0xff7ab8, 0x00b5ad]
const PANTS = [0x2b3a67, 0x1b1b22, 0x3d2b1f, 0x2e5c3a]
const SKIN = 0xffd9a8

const _c = new Color()
const _root = new Object3D()
/** Which player each avatar slot was last coloured for (colours only change with the owner). */
const slotOwner: string[] = new Array(MAX_CLIENTS).fill('')
let slotsInUse = MAX_CLIENTS
const _m = new Matrix4()
const _r = new Matrix4()
const _t = new Matrix4()
const _s = new Matrix4()

/** Root × pivot × swing × offset-from-pivot × scale; scratch matrices only. */
function setPart(mesh: InstancedMesh, index: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, swing: number, pivotY: number) {
  _m.makeTranslation(x, pivotY, z)
  _m.multiply(_r.makeRotationX(swing))
  _m.multiply(_t.makeTranslation(0, y - pivotY, 0))
  _m.multiply(_s.makeScale(sx, sy, sz))
  _m.premultiply(_root.matrix)
  mesh.setMatrixAt(index, _m)
}

export function RemotePlayers() {
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), [])
  const material = useMemo(() => new MeshLambertMaterial(), [])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )
  // Create the colour attribute up front: adding it later would recompile the shader mid-game.
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    for (let k = 0; k < CAPACITY; k += 1) {
      mesh.setMatrixAt(k, HIDDEN)
      mesh.setColorAt(k, _c.setHex(SKIN))
    }
    slotOwner.fill('')
    slotsInUse = 0
  }, [])

  useFrame((_s, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const ms = performance.now()
    const t = now()
    let i = 0
    for (; i < remoteList.length && i < MAX_CLIENTS - 1; i += 1) {
      const p = remoteList[i]
      const prevX = p.px
      const prevZ = p.pz
      sampleRemote(p, ms)
      const dist = Math.hypot(p.px - prevX, p.pz - prevZ)
      // Smoothed over ~0.15 s whatever the frame rate, so the stride never stutters.
      p.speed += ((delta > 0 ? dist / delta : 0) - p.speed) * (1 - Math.exp(-delta / 0.15))
      p.walkPhase += delta * (4 + p.speed)
      const walk = Math.min(1, p.speed / 6) * Math.sin(p.walkPhase * 2)
      const throwing = t - p.throwAt < THROW_ANIM_S
      const throwArm = throwing ? -2.4 + ((t - p.throwAt) / THROW_ANIM_S) * 2.6 : walk * 0.8

      _root.position.set(p.px, p.py, p.pz)
      _root.rotation.set(0, p.prot, 0)
      _root.updateMatrix()
      const base = i * PARTS
      if (p.full) {
        // Drawn as a full Bloxity avatar by RemoteAvatars.
        for (let k = 0; k < PARTS; k += 1) mesh.setMatrixAt(base + k, HIDDEN)
        continue
      }
      setPart(mesh, base + 0, 0, 1.95, 0, 0.75, 0.75, 0.75, 0, 1.95) // head
      setPart(mesh, base + 1, 0, 1.25, 0, 1.0, 0.9, 0.5, 0, 1.25) // torso
      setPart(mesh, base + 2, -0.68, 1.25, 0, 0.36, 0.9, 0.42, throwArm, 1.62) // right arm
      setPart(mesh, base + 3, 0.68, 1.25, 0, 0.36, 0.9, 0.42, -walk * 0.8, 1.62) // left arm
      setPart(mesh, base + 4, -0.25, 0.4, 0, 0.45, 0.8, 0.45, -walk, 0.8) // legs
      setPart(mesh, base + 5, 0.25, 0.4, 0, 0.45, 0.8, 0.45, walk, 0.8)

      if (slotOwner[i] !== p.sessionId) {
        slotOwner[i] = p.sessionId
        const h = hashString(p.pid || p.sessionId)
        const pants = PANTS[(h >> 4) % PANTS.length]
        mesh.setColorAt(base + 0, _c.setHex(SKIN))
        mesh.setColorAt(base + 1, _c.setHex(SHIRTS[h % SHIRTS.length]))
        mesh.setColorAt(base + 2, _c.setHex(SKIN))
        mesh.setColorAt(base + 3, _c.setHex(SKIN))
        mesh.setColorAt(base + 4, _c.setHex(pants))
        mesh.setColorAt(base + 5, _c.setHex(pants))
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      }
    }
    // Hide slots that just emptied (once, not every frame).
    if (i < slotsInUse) {
      for (let k = i * PARTS; k < slotsInUse * PARTS && k < CAPACITY; k += 1) mesh.setMatrixAt(k, HIDDEN)
      for (let s = i; s < slotsInUse; s += 1) slotOwner[s] = ''
    }
    slotsInUse = i
    mesh.instanceMatrix.needsUpdate = true
  })

  // Name tags are DOM (ui/NameTags.tsx), positioned by game/NameTagProjector.tsx.
  return <instancedMesh ref={ref} args={[geometry, material, CAPACITY]} castShadow frustumCulled={false} />
}

export default RemotePlayers
