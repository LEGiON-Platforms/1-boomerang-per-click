import { useFrame } from '@react-three/fiber'
import { EGG_SPOTS, EGGS } from '@game/shared'
import { useEffect, useMemo, useRef } from 'react'
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  type InstancedMesh,
  MeshLambertMaterial,
  Object3D,
  SRGBColorSpace,
} from 'three'

import { useGame } from '../../state/gameStore'
import { drawOutlined } from '../canvasText'
import { now } from '../runtime'

/** The wins-priced eggs are "?" lucky blocks; the event egg is a static prop. */
const BLOCK_EGGS = EGGS.map((e, i) => ({ egg: e, spot: EGG_SPOTS[i] })).filter((x) => x.egg.currency === 'wins')

function questionTexture(): CanvasTexture {
  const size = 128
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  // Light face, darker bevelled rim: tinted by each block's instance colour.
  ctx.fillStyle = '#9a9a9a'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#d0d0d0'
  ctx.fillRect(8, 8, size - 16, size - 16)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(12, 12, size - 24, size - 30)
  drawOutlined(ctx, '??', size / 2, size / 2 + 4, 76, '#ffffff', { stroke: '#2a2a2a', outline: 0.22 })
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

export function EggBlocks() {
  const ref = useRef<InstancedMesh>(null)
  const best = useGame((s) => s.data?.bestStageEver ?? 0)
  const geometry = useMemo(() => new BoxGeometry(2.4, 2.4, 2.4), [])
  const texture = useMemo(questionTexture, [])
  const material = useMemo(() => new MeshLambertMaterial({ map: texture }), [texture])
  const dummy = useMemo(() => new Object3D(), [])

  useEffect(
    () => () => {
      geometry.dispose()
      texture.dispose()
      material.dispose()
    },
    [geometry, texture, material],
  )

  // Colours change only when an egg unlocks, not per frame.
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const c = new Color()
    BLOCK_EGGS.forEach(({ egg }, i) => {
      c.set(egg.color)
      if (best < egg.unlockStage) c.multiplyScalar(0.35)
      mesh.setColorAt(i, c)
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [best])

  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const t = now()
    for (let i = 0; i < BLOCK_EGGS.length; i += 1) {
      const spot = BLOCK_EGGS[i].spot
      dummy.position.set(spot.x, 2.1 + Math.sin(t * 1.6 + i) * 0.18, spot.z)
      dummy.rotation.set(0, t * 0.5 + i, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[geometry, material, BLOCK_EGGS.length]} castShadow frustumCulled={false} />
}
