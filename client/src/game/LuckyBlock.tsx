import { useFrame } from '@react-three/fiber'
import { LUCKY_PHASE } from '@game/shared'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  type Group,
  MeshBasicMaterial,
  MeshLambertMaterial,
  SRGBColorSpace,
} from 'three'

import { useGame } from '../state/gameStore'
import { drawOutlined } from './canvasText'
import { now } from './runtime'

function rainbowTexture(): CanvasTexture {
  const s = 128
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, s, s)
  ;['#ff4d4d', '#ffd21f', '#2ee66b', '#3da5ff', '#b04dff'].forEach((col, i) => g.addColorStop(i / 4, col))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = 8
  ctx.strokeRect(6, 6, s - 12, s - 12)
  drawOutlined(ctx, '??', s / 2, s / 2 + 4, 72, '#ffffff', { stroke: '#2a2a2a', outline: 0.22 })
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** The dropped lucky block: a rainbow "??" block under a tall beam (only while active). */
function ActiveLuckyBlock({ x, z }: { x: number; z: number }) {
  const blockRef = useRef<Group>(null)
  const res = useMemo(() => {
    const texture = rainbowTexture()
    return {
      texture,
      block: new BoxGeometry(2.2, 2.2, 2.2),
      beam: new CylinderGeometry(1.1, 1.6, 70, 12, 1, true),
      blockMat: new MeshLambertMaterial({ map: texture, emissive: '#ffffff', emissiveIntensity: 0.25 }),
      beamMat: new MeshBasicMaterial({ color: '#7fe8ff', transparent: true, opacity: 0.28, blending: AdditiveBlending, depthWrite: false }),
    }
  }, [])
  useEffect(
    () => () => {
      res.texture.dispose()
      res.block.dispose()
      res.beam.dispose()
      res.blockMat.dispose()
      res.beamMat.dispose()
    },
    [res],
  )
  useFrame(() => {
    const g = blockRef.current
    if (!g) return
    const t = now()
    g.position.y = 1.6 + Math.sin(t * 3) * 0.3
    g.rotation.y = t * 1.5
  })
  return (
    <group position={[x, 0, z]}>
      <group ref={blockRef}>
        <mesh geometry={res.block} material={res.blockMat} castShadow />
      </group>
      <mesh geometry={res.beam} material={res.beamMat} position={[0, 35, 0]} renderOrder={5} />
    </group>
  )
}

export function LuckyBlock() {
  const lucky = useGame((s) => s.lucky)
  if (lucky.phase !== LUCKY_PHASE.active) return null
  return <ActiveLuckyBlock key={`${lucky.x},${lucky.z}`} x={lucky.x} z={lucky.z} />
}

export default LuckyBlock
