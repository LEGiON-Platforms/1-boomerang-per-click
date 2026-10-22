import { formatNumber, LEADERBOARD_SPOTS, type LeaderboardEntry } from '@game/shared'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MeshBasicMaterial } from 'three'

import { useGame } from '../../state/gameStore'
import { useQuality } from '../../state/qualityStore'
import { drawIcon, drawOutlined, roundRect, vGradient } from '../canvasText'
import { buildSignAtlas, type SignAtlas, type SignSpec } from '../signs'
import { useCanvasAssets } from './LobbySigns'

const BOARD_W = 12
const BOARD_H = 11.6
const RANK_COLORS = ['#ffd23f', '#d6dde6', '#e0915a']

function boardSpec(
  index: number,
  title: string,
  icon: 'trophy' | 'target' | 'rebirth',
  rows: LeaderboardEntry[],
  accent: [string, string],
): SignSpec {
  const spot = LEADERBOARD_SPOTS[index]
  return {
    w: BOARD_W,
    h: BOARD_H,
    x: spot.x,
    y: BOARD_H / 2 + 0.6,
    z: spot.z,
    rotY: Math.PI,
    draw: (ctx, w, h) => {
      roundRect(ctx, 0, 0, w, h, w * 0.04)
      ctx.fillStyle = '#20222c'
      ctx.fill()
      const headH = h * 0.14
      roundRect(ctx, w * 0.03, h * 0.025, w * 0.94, headH, headH * 0.3)
      ctx.fillStyle = vGradient(ctx, 0, headH, accent[0], accent[1])
      ctx.fill()
      drawIcon(ctx, icon, w * 0.13, h * 0.025 + headH / 2, headH * 0.75)
      drawOutlined(ctx, title, w * 0.55, h * 0.025 + headH / 2, headH * 0.58, '#ffffff', { maxWidth: w * 0.7 })

      const top = h * 0.19
      const rowH = (h * 0.79) / 10
      for (let i = 0; i < 10; i += 1) {
        const y = top + i * rowH
        roundRect(ctx, w * 0.03, y + rowH * 0.06, w * 0.94, rowH * 0.88, rowH * 0.2)
        ctx.fillStyle = i % 2 ? '#2c2f3c' : '#353949'
        ctx.fill()
        const entry = rows[i]
        const cy = y + rowH / 2
        drawOutlined(ctx, `#${i + 1}`, w * 0.09, cy, rowH * 0.52, RANK_COLORS[i] ?? '#9aa3b5')
        if (entry) {
          drawOutlined(ctx, entry.name, w * 0.17, cy, rowH * 0.5, '#ffffff', { align: 'left', maxWidth: w * 0.5 })
          drawOutlined(ctx, formatNumber(entry.value), w * 0.94, cy, rowH * 0.5, '#ffe14a', { align: 'right', maxWidth: w * 0.26 })
        } else {
          drawOutlined(ctx, '—', w * 0.5, cy, rowH * 0.45, '#5d6375')
        }
      }
    },
  }
}

/** The three global top-10 boards behind the eggs, refreshed every 60 s. */
export function Leaderboards() {
  const ready = useCanvasAssets()
  const boards = useGame((s) => s.leaderboards)
  const ppu = useQuality((s) => Math.min(s.settings.signPpu, 28))
  const maxSize = useQuality((s) => (s.settings.textureSize >= 512 ? 1024 : 512))
  const [atlas, setAtlas] = useState<SignAtlas | null>(null)
  const atlasRef = useRef<SignAtlas | null>(null)

  useEffect(() => {
    if (!ready) return
    const specs = [
      boardSpec(0, 'TOP WINS', 'trophy', boards.wins, ['#ffb21a', '#ff7a00']),
      boardSpec(1, 'HIGHEST STAGE', 'target', boards.stage, ['#ff5a5a', '#c81e3c']),
      boardSpec(2, 'TOP REBIRTHS', 'rebirth', boards.rebirths, ['#c46bff', '#7b2fbf']),
    ]
    const next = buildSignAtlas(specs, ppu, maxSize, atlasRef.current ?? undefined)
    atlasRef.current = next
    setAtlas(next)
  }, [ready, boards, ppu, maxSize])

  const material = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), [])
  useEffect(() => {
    material.map = atlas?.texture ?? null
    material.needsUpdate = true
  }, [atlas, material])

  useEffect(
    () => () => {
      material.dispose()
      atlasRef.current?.texture.dispose()
      atlasRef.current?.geometry.dispose()
      atlasRef.current = null
    },
    [material],
  )

  if (!atlas) return null
  return <mesh geometry={atlas.geometry} material={material} />
}
