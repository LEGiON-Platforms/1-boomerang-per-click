import { useFrame } from '@react-three/fiber'
import { BOOMERANG_SPOTS, BOOMERANG_STAGE, BOOMERANGS } from '@game/shared'
import { useEffect, useMemo, useRef } from 'react'
import { type Mesh, MeshBasicMaterial, RingGeometry } from 'three'

import { useGame } from '../../state/gameStore'
import { now } from '../runtime'
import { displayStart } from './boomerangDisplay'

/** A pulsing ring around the next boomerang's buy pad: green when affordable, orange when not. */
export function NextBoomerangGlow() {
  const owned = useGame((s) => s.data?.boomerangsOwned ?? 1)
  const next = BOOMERANGS[owned]
  const affordable = useGame((s) => (next ? s.wins >= next.cost : false))
  const ref = useRef<Mesh>(null)
  const geometry = useMemo(
    () => new RingGeometry(BOOMERANG_STAGE.padRadius - 0.1, BOOMERANG_STAGE.padRadius + 0.35, 32).rotateX(-Math.PI / 2),
    [],
  )
  const material = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }), [])
  useEffect(() => {
    material.color.set(affordable ? '#5dff6b' : '#ffb13b')
  }, [material, affordable])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )
  useFrame(() => {
    const m = ref.current
    if (!m) return
    const s = 1 + Math.sin(now() * 5) * 0.07
    m.scale.set(s, 1, s)
  })

  const index = next ? next.id - displayStart(owned) : -1
  const spot = BOOMERANG_SPOTS[index]
  if (!spot) return null
  return <mesh ref={ref} geometry={geometry} material={material} position={[spot.x, spot.y + 0.2, spot.z]} />
}
