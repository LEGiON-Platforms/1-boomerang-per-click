import { useFrame } from '@react-three/fiber'
import { HALLOWEEN, PUMPKIN_SPOTS } from '@game/shared'
import { useEffect, useMemo, useRef } from 'react'
import { type InstancedMesh, Matrix4, MeshLambertMaterial, Object3D } from 'three'

import { PropBuilder } from './builder'
import { pumpkinVisible } from './pickups'
import { localPlayer, now } from './runtime'

/** Halloween event: collectible pumpkins (per-player respawn), only near the player. */
const VIEW_DISTANCE = 70
const HIDDEN = new Matrix4().makeScale(0, 0, 0)
const _o = new Object3D()

export function Pumpkins() {
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => new PropBuilder().pumpkin(0, 0, 0, 0.7).build(), [])
  const material = useMemo(() => new MeshLambertMaterial({ vertexColors: true, emissive: '#ff6a00', emissiveIntensity: 0.25 }), [])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const t = now()
    const ms = performance.now()
    const p = localPlayer.pos
    for (let i = 0; i < PUMPKIN_SPOTS.length; i += 1) {
      const s = PUMPKIN_SPOTS[i]
      const dx = s.x - p.x
      const dz = s.z - p.z
      if (dx * dx + dz * dz > VIEW_DISTANCE * VIEW_DISTANCE || !pumpkinVisible(i, ms)) {
        mesh.setMatrixAt(i, HIDDEN)
        continue
      }
      _o.position.set(s.x, 0.25 + Math.abs(Math.sin(t * 2.5 + i)) * 0.35, s.z)
      _o.rotation.set(0, t * 0.8 + i, 0)
      _o.updateMatrix()
      mesh.setMatrixAt(i, _o.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  if (!HALLOWEEN.enabled) return null
  return <instancedMesh ref={ref} args={[geometry, material, PUMPKIN_SPOTS.length]} castShadow frustumCulled={false} />
}

export default Pumpkins
