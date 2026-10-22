import { useFrame } from '@react-three/fiber'
import { SPAWN } from '@game/shared'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  type InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  Shape,
  ShapeGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { now } from '../runtime'

/** Arrow centres (z) on the floor from the spawn plaza to the stage gate, which is down -z. */
const ARROW_Z = [21, 14.5, 8, 1.5]
/** Above the plaza and path paving (highest ring at 0.05). */
const LIFT = 0.08
/** Arrow scale: big enough to read as arrows from the low follow camera (~3.7 m wide). */
const ARROW_SIZE = 1.7
const YELLOW = new Color('#ffd21f')
const OUTLINE = new Color('#7a4a00')

const _o = new Object3D()
const _c = new Color()

/** A flat arrow pointing -z (towards the gate), as an outline under a yellow fill. */
function arrowGeometry(): BufferGeometry {
  const shape = (s: number) => {
    const sh = new Shape()
    sh.moveTo(-0.45 * s, -1.2 * s)
    sh.lineTo(0.45 * s, -1.2 * s)
    sh.lineTo(0.45 * s, 0.05 * s)
    sh.lineTo(1.1 * s, 0.05 * s)
    sh.lineTo(0, 1.25 * s)
    sh.lineTo(-1.1 * s, 0.05 * s)
    sh.lineTo(-0.45 * s, 0.05 * s)
    sh.closePath()
    return sh
  }
  const part = (s: number, y: number, color: Color) => {
    // Drawn in XY with the tip at +Y; laid flat it points down -Z, facing up.
    const g = new ShapeGeometry(shape(s)).rotateX(-Math.PI / 2).translate(0, y, 0)
    const n = g.getAttribute('position').count
    const colors = new Float32Array(n * 3)
    for (let i = 0; i < n; i += 1) colors.set([color.r, color.g, color.b], i * 3)
    g.setAttribute('color', new Float32BufferAttribute(colors, 3))
    return g
  }
  const outline = part(ARROW_SIZE * 1.12, 0, OUTLINE)
  const fill = part(ARROW_SIZE, 0.01, YELLOW)
  const merged = mergeGeometries([outline, fill])
  outline.dispose()
  fill.dispose()
  return merged
}

/**
 * Yellow arrows on the lobby floor leading from the spawn plaza to the stage gate,
 * with a brightness wave running along them towards the gate. One draw call.
 */
export function GateArrows() {
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => arrowGeometry(), [])
  const material = useMemo(() => new MeshBasicMaterial({ vertexColors: true, toneMapped: false }), [])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    for (let i = 0; i < ARROW_Z.length; i += 1) {
      _o.position.set(SPAWN.x, LIFT, ARROW_Z[i])
      _o.updateMatrix()
      mesh.setMatrixAt(i, _o.matrix)
      mesh.setColorAt(i, _c.setScalar(1))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [])

  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const t = now()
    for (let i = 0; i < ARROW_Z.length; i += 1) {
      // A bright pulse sweeping from the plaza towards the gate.
      const wave = Math.max(0, Math.sin(t * 4 - i * 0.9))
      mesh.setColorAt(i, _c.setScalar(0.72 + wave * 0.4))
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[geometry, material, ARROW_Z.length]} renderOrder={1} />
}
