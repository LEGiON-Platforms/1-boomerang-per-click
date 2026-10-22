import { useFrame } from '@react-three/fiber'
import { TRAINING_PAD_SPOTS } from '@game/shared'
import { useEffect, useMemo, useRef } from 'react'
import { type BufferGeometry, type InstancedMesh, MeshLambertMaterial, Object3D } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { PropBuilder } from '../builder'
import { dummyHitAt } from '../fx/projectiles'
import { now } from '../runtime'

const DECK_TOP = 1.2

/** Where a throw strikes a dummy: the centre of the target on its chest (dummy x + this, y). */
export const DUMMY_STRIKE = { dx: 0.5, y: DECK_TOP + 1.95 }

/** One target dummy facing +X (towards the pads), as a single geometry. */
function buildDummyGeometry(): BufferGeometry {
  const body = new PropBuilder()
  body.block(0, 0, 0, 0.35, 1.2, 0.35, '#7a4b2a') // post
  body.block(0, 1.1, 0, 0.9, 1.7, 1.5, '#d9a066') // torso
  body.block(0, 2.8, 0, 0.85, 0.85, 0.85, '#d9a066') // head
  body.block(0, 1.7, 1.0, 0.5, 1.2, 0.45, '#c98a4b') // arms
  body.block(0, 1.7, -1.0, 0.5, 1.2, 0.45, '#c98a4b')
  body.block(0.44, 3.0, 0.2, 0.05, 0.12, 0.12, '#2b1a0a') // eyes
  body.block(0.44, 3.0, -0.2, 0.05, 0.12, 0.12, '#2b1a0a')

  // Target rings: thin discs built upright, then turned to face +X on the chest.
  const target = new PropBuilder()
  const rings: [number, string][] = [
    [0.62, '#ffffff'],
    [0.5, '#e8323c'],
    [0.34, '#ffffff'],
    [0.2, '#e8323c'],
  ]
  rings.forEach(([r, c], i) => target.cylinder(0, 0, 0, r, 0.06 + i * 0.012, c, 20))
  const ringGeo = target.build()
  ringGeo.rotateZ(-Math.PI / 2)
  ringGeo.translate(0.46, 1.95, 0)

  const bodyGeo = body.build()
  const merged = mergeGeometries([bodyGeo, ringGeo], false)!
  bodyGeo.dispose()
  ringGeo.dispose()
  return merged
}

/** All seven training dummies in one instanced draw call; each wobbles when hit. */
export function Dummies() {
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(buildDummyGeometry, [])
  const material = useMemo(() => new MeshLambertMaterial({ vertexColors: true }), [])
  const dummy = useMemo(() => new Object3D(), [])

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
    for (let i = 0; i < TRAINING_PAD_SPOTS.length; i += 1) {
      const s = TRAINING_PAD_SPOTS[i].dummy
      const since = t - dummyHitAt[i]
      const wobble = since < 0.6 ? Math.sin(since * 28) * 0.25 * (1 - since / 0.6) : 0
      dummy.position.set(s.x, DECK_TOP, s.z)
      dummy.rotation.set(0, 0, wobble)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, TRAINING_PAD_SPOTS.length]}
      castShadow
      frustumCulled={false}
    />
  )
}
