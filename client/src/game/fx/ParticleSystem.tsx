import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BoxGeometry, InstancedBufferAttribute, type InstancedMesh, Matrix4, MeshLambertMaterial, Object3D } from 'three'

import { useQuality } from '../../state/qualityStore'
import { PARTICLE_CAPACITY, particles } from './particles'

const GRAVITY = 22
const HIDDEN = new Matrix4().makeScale(0, 0, 0)
const _o = new Object3D()

/** Renders the pooled brick particles; not mounted at all on LOW. */
function Particles({ capacity }: { capacity: number }) {
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => new BoxGeometry(1, 0.6, 0.6), [])
  const material = useMemo(() => new MeshLambertMaterial(), [])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    mesh.instanceColor = new InstancedBufferAttribute(particles.color, 3)
    for (let i = 0; i < capacity; i += 1) mesh.setMatrixAt(i, HIDDEN)
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [capacity, geometry, material])

  useFrame((_s, delta) => {
    const mesh = ref.current
    if (!mesh) return
    const dt = Math.min(delta, 0.05)
    const { pos, vel, rot, life, maxLife, size } = particles
    for (let i = 0; i < capacity; i += 1) {
      if (life[i] <= 0) {
        mesh.setMatrixAt(i, HIDDEN)
        continue
      }
      life[i] -= dt
      const i3 = i * 3
      vel[i3 + 1] -= GRAVITY * dt
      pos[i3] += vel[i3] * dt
      pos[i3 + 1] += vel[i3 + 1] * dt
      pos[i3 + 2] += vel[i3 + 2] * dt
      if (pos[i3 + 1] < 0.15) {
        pos[i3 + 1] = 0.15
        vel[i3 + 1] *= -0.35
        vel[i3] *= 0.7
        vel[i3 + 2] *= 0.7
      }
      rot[i3] += dt * 6
      rot[i3 + 2] += dt * 4
      const fade = Math.min(1, life[i] / (maxLife[i] * 0.35))
      _o.position.set(pos[i3], pos[i3 + 1], pos[i3 + 2])
      _o.rotation.set(rot[i3], rot[i3 + 1], rot[i3 + 2])
      _o.scale.setScalar(size[i] * fade)
      _o.updateMatrix()
      mesh.setMatrixAt(i, _o.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[geometry, material, capacity]} frustumCulled={false} />
}

export function ParticleSystem() {
  const max = useQuality((s) => s.settings.particles)
  if (max <= 0) return null
  return <Particles capacity={Math.min(max, PARTICLE_CAPACITY)} />
}

export default ParticleSystem
