import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  BackSide,
  BufferAttribute,
  Color,
  IcosahedronGeometry,
  type InstancedMesh,
  type Mesh,
  MeshBasicMaterial,
  Object3D,
  Triangle,
  Vector3,
} from 'three'

import { useQuality } from '../state/qualityStore'
import { localPlayer } from './runtime'
import { CLOUDS, LIGHTS, SKY } from './sceneStyle'

const skyVertexShader = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const skyFragmentShader = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform float exponent;
  varying vec3 vDirection;
  void main() {
    float h = normalize(vDirection).y;
    vec3 color = mix(horizonColor, topColor, pow(max(h, 0.0), exponent));
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`

/** Gradient dome that follows the camera; sized inside the far plane. */
function SkyDome({ radius }: { radius: number }) {
  const ref = useRef<Mesh>(null)
  const camera = useThree((s) => s.camera)
  const uniforms = useMemo(
    () => ({
      topColor: { value: new Color(SKY.top) },
      horizonColor: { value: new Color(SKY.horizon) },
      exponent: { value: SKY.exponent },
    }),
    [],
  )
  useFrame(() => {
    ref.current?.position.copy(camera.position)
  })
  return (
    <mesh ref={ref} renderOrder={-1} frustumCulled={false} scale={radius}>
      <sphereGeometry args={[1, 24, 12]} />
      <shaderMaterial
        side={BackSide}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={skyVertexShader}
        fragmentShader={skyFragmentShader}
      />
    </mesh>
  )
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Faceted puff with sun/shadow baked into vertex colours (stays white under any light). */
function createPuffGeometry() {
  const geometry = new IcosahedronGeometry(1, 1)
  const position = geometry.getAttribute('position')
  const colors = new Float32Array(position.count * 3)
  const top = new Color(CLOUDS.top)
  const bottom = new Color(CLOUDS.bottom)
  const sun = new Vector3(...(LIGHTS.sunDirection as [number, number, number])).normalize()
  const a = new Vector3()
  const b = new Vector3()
  const c = new Vector3()
  const n = new Vector3()
  const col = new Color()
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i)
    b.fromBufferAttribute(position, i + 1)
    c.fromBufferAttribute(position, i + 2)
    Triangle.getNormal(a, b, c, n)
    if (n.dot(a) < 0) n.negate()
    const up = n.y * 0.5 + 0.5
    const lit = Math.max(n.dot(sun), 0) * 0.35
    col.copy(bottom).lerp(top, Math.min(1, up * 0.85 + lit))
    for (let v = 0; v < 3; v += 1) {
      colors[(i + v) * 3] = col.r
      colors[(i + v) * 3 + 1] = col.g
      colors[(i + v) * 3 + 2] = col.b
    }
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3))
  return geometry
}

/** Every puff of every cloud in ONE instanced draw call. */
function Clouds() {
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(createPuffGeometry, [])
  const material = useMemo(() => new MeshBasicMaterial({ vertexColors: true, fog: false }), [])
  const puffs = useMemo(() => {
    const rand = mulberry32(7)
    const out: { x: number; y: number; z: number; sx: number; sy: number; sz: number }[] = []
    for (let i = 0; i < CLOUDS.count; i += 1) {
      const size = 7 + rand() * 6
      const cx = (rand() * 2 - 1) * 220
      const cy = 40 + rand() * 16
      const cz = (rand() * 2 - 1) * 260 - 60
      const n = 3 + Math.floor(rand() * 3)
      for (let p = 0; p < n; p += 1) {
        const along = (p - (n - 1) / 2) * size * 0.9
        const taper = 1 - Math.abs(along) / (size * n * 0.6)
        const s = size * (0.75 + rand() * 0.35) * taper
        out.push({ x: cx + along, y: cy + (rand() - 0.3) * size * 0.4, z: cz + (rand() - 0.5) * size * 0.6, sx: s, sy: s * 0.75, sz: s * 0.85 })
      }
      out.push({ x: cx + (rand() - 0.5) * size, y: cy + size * 0.55, z: cz, sx: size * 0.8, sy: size * 0.65, sz: size * 0.7 })
    }
    return out
  }, [])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const o = new Object3D()
    puffs.forEach((p, i) => {
      o.position.set(p.x, p.y, p.z)
      o.scale.set(p.sx, p.sy, p.sz)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [puffs])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  // Clouds drift with the player along the corridor so the sky never empties.
  useFrame((_s, delta) => {
    const mesh = ref.current
    if (!mesh) return
    mesh.position.z = Math.min(0, localPlayer.pos.z)
    mesh.rotation.y += delta * 0.003
  })

  return <instancedMesh ref={ref} args={[geometry, material, puffs.length]} frustumCulled={false} />
}

export function Sky() {
  const clouds = useQuality((s) => s.settings.clouds)
  const far = useQuality((s) => s.settings.viewDistance)
  return (
    <>
      <SkyDome radius={far * 0.95} />
      {clouds && <Clouds />}
    </>
  )
}

export default Sky
