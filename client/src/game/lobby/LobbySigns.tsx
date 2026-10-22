import {
  BOOMERANGS,
  EGG_SPOTS,
  EGGS,
  formatNumber,
  INVITE_BOARD,
  LIKE_BOARD,
  LIKE_GOAL,
  PEDESTAL_SPOTS,
  REBIRTH_STATUE,
  SPAWN,
  STAGES_PORTAL,
  TRAILS_STALL,
  TRAINING_PAD_SPOTS,
  TRAINING_PADS,
} from '@game/shared'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MeshBasicMaterial } from 'three'

import { useGame } from '../../state/gameStore'
import { useQuality } from '../../state/qualityStore'
import {
  drawIcon,
  drawOutlined,
  ensureFont,
  preloadImages,
  REBIRTH_ICON,
  roundRect,
  vGradient,
} from '../canvasText'
import { buildSignAtlas, type SignAtlas, type SignSpec } from '../signs'

/** Font and icon images must be ready before anything is drawn into a canvas. */
export function useCanvasAssets(): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    void Promise.all([ensureFont(), preloadImages([REBIRTH_ICON])]).then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [])
  return ready
}

const faceToward = (from: { x: number; z: number }, to: { x: number; z: number }) =>
  Math.atan2(to.x - from.x, to.z - from.z)

function panel(ctx: CanvasRenderingContext2D, w: number, h: number, fill = 'rgba(20,20,28,0.72)', border = 'rgba(255,255,255,0.18)') {
  roundRect(ctx, 2, 2, w - 4, h - 4, Math.min(w, h) * 0.14)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = Math.max(2, h * 0.03)
  ctx.strokeStyle = border
  ctx.stroke()
}

/** Big floating header text, like "TRAINING" / "TRAILS". */
function header(text: string, icon?: Parameters<typeof drawIcon>[1]): SignSpec['draw'] {
  return (ctx, w, h) => {
    const size = h * 0.78
    if (icon) {
      drawIcon(ctx, icon, h * 0.5, h / 2, h * 0.8)
      drawOutlined(ctx, text, w / 2 + h * 0.4, h / 2, size, '#ffffff', { maxWidth: w - h * 1.2 })
    } else {
      drawOutlined(ctx, text, w / 2, h / 2, size, '#ffffff', { maxWidth: w - 8 })
    }
  }
}

interface SignInputs {
  rebirths: number
  bestStage: number
  boomerangsOwned: number
}

/** First boomerang shown on the six display pedestals: the best owned one. */
export function pedestalStart(owned: number): number {
  return Math.max(0, Math.min(owned - 1, BOOMERANGS.length - PEDESTAL_SPOTS.length))
}

function buildSpecs({ rebirths, bestStage, boomerangsOwned }: SignInputs): SignSpec[] {
  const specs: SignSpec[] = []

  // Gate.
  specs.push({
    w: 15,
    h: 3.6,
    x: 0,
    y: 15.6,
    z: 0.4,
    rotY: 0,
    draw: (ctx, w, h) => {
      drawOutlined(ctx, 'DESTROY WALLS', w / 2, h * 0.27, h * 0.42, '#ffffff', { maxWidth: w - 8 })
      drawOutlined(ctx, 'TO EARN WINS!', w / 2, h * 0.73, h * 0.42, '#ffffff', { maxWidth: w - 8 })
    },
  })

  // Training area.
  specs.push({ w: 13, h: 2.8, x: -43.6, y: 9, z: 29, rotY: Math.PI / 2, draw: header('TRAINING', 'target') })
  TRAINING_PAD_SPOTS.forEach((s, i) => {
    const pad = TRAINING_PADS[i]
    const locked = rebirths < pad.requiredRebirths
    specs.push({
      w: 3.6,
      h: 2.3,
      x: s.dummy.x + 0.3,
      y: 6.3,
      z: s.dummy.z,
      rotY: Math.PI / 2,
      draw: (ctx, w, h) => {
        panel(ctx, w, h, locked ? 'rgba(90,16,22,0.78)' : 'rgba(20,20,28,0.72)')
        if (pad.requiredRebirths === 0) {
          drawOutlined(ctx, 'FREE', w / 2, h * 0.36, h * 0.42, vGradient(ctx, h * 0.15, h * 0.55, '#d8ff5a', '#3ee060'))
        } else {
          drawOutlined(ctx, pad.label, w * 0.38, h * 0.36, h * 0.42, '#ffffff')
          drawIcon(ctx, 'rebirth', w * 0.66, h * 0.36, h * 0.4)
        }
        drawOutlined(ctx, `x${pad.mult} Power`, w / 2, h * 0.76, h * 0.25, '#ffe14a', { maxWidth: w - 10 })
        if (locked) drawIcon(ctx, 'lock', w * 0.88, h * 0.2, h * 0.28)
      },
    })
    // "STAND HERE" decal on the pad.
    specs.push({
      w: 3.6,
      h: 1.7,
      x: s.pad.x,
      y: 0.17,
      z: s.pad.z,
      rotY: Math.PI / 2,
      flat: true,
      draw: (ctx, w, h) => {
        drawOutlined(ctx, 'STAND', w / 2, h * 0.28, h * 0.4, 'rgba(255,255,255,0.92)', { outline: 0.12 })
        drawOutlined(ctx, 'HERE', w / 2, h * 0.74, h * 0.4, 'rgba(255,255,255,0.92)', { outline: 0.12 })
      },
    })
  })

  // Boomerang display.
  specs.push({ w: 14, h: 2.8, x: 41, y: 10, z: 27.5, rotY: -Math.PI / 2, draw: header('BOOMERANGS', 'bolt') })
  const start = pedestalStart(boomerangsOwned)
  PEDESTAL_SPOTS.forEach((p, i) => {
    const b = BOOMERANGS[start + i]
    if (!b) return
    const owned = b.id < boomerangsOwned
    const isNext = b.id === boomerangsOwned
    specs.push({
      w: 4,
      h: 2.2,
      x: p.x,
      y: 4.5,
      z: p.z,
      rotY: -Math.PI / 2,
      draw: (ctx, w, h) => {
        drawOutlined(ctx, `+${formatNumber(b.power)} Power`, w / 2, h * 0.24, h * 0.3, '#5fd3ff', { maxWidth: w - 6 })
        const label = owned ? 'OWNED' : `${formatNumber(b.cost)} WINS`
        drawOutlined(ctx, label, w / 2, h * 0.6, h * 0.3, owned ? '#9cff6b' : isNext ? '#ffe14a' : '#ffb35c', {
          maxWidth: w - 6,
        })
        drawOutlined(ctx, b.name, w / 2, h * 0.88, h * 0.2, '#ffffff', { maxWidth: w - 6 })
      },
    })
  })

  // Trails stall, stages portal.
  specs.push({ w: 8, h: 2, x: TRAILS_STALL.x, y: 6.4, z: TRAILS_STALL.z + 1.4, rotY: 0, draw: header('TRAILS', 'bolt') })
  specs.push({ w: 8, h: 2, x: STAGES_PORTAL.x, y: 10.5, z: STAGES_PORTAL.z, rotY: 0, draw: header('STAGES', 'target') })

  // Rebirth statue: the player's rebirth icon floating above the pedestal.
  specs.push({
    w: 5.2,
    h: 6,
    x: REBIRTH_STATUE.x,
    y: 5.6,
    z: REBIRTH_STATUE.z,
    rotY: faceToward(REBIRTH_STATUE, SPAWN),
    draw: (ctx, w, h) => {
      drawIcon(ctx, 'rebirth', w / 2, h * 0.36, Math.min(w, h * 0.62))
      drawOutlined(ctx, 'REBIRTH', w / 2, h * 0.74, h * 0.15, '#ff7ad9', { maxWidth: w - 6 })
      drawOutlined(ctx, `Next: x${rebirths + 2} Power`, w / 2, h * 0.9, h * 0.1, '#ffe14a', { maxWidth: w - 6 })
    },
  })

  // Eggs.
  specs.push({ w: 13, h: 2.8, x: -4, y: 10, z: 60.5, rotY: Math.PI, draw: header('TRAINERS', 'trophy') })
  EGGS.forEach((egg, i) => {
    const spot = EGG_SPOTS[i]
    const locked = bestStage < egg.unlockStage
    const isEvent = egg.id === 'event'
    specs.push({
      w: 4.6,
      h: 2.4,
      x: spot.x,
      y: isEvent ? 7.6 : 5.4,
      z: spot.z,
      rotY: Math.PI,
      draw: (ctx, w, h) => {
        drawOutlined(ctx, egg.name, w / 2, h * 0.22, h * 0.24, '#ffffff', { maxWidth: w - 6 })
        if (locked) {
          drawIcon(ctx, 'lock', w * 0.2, h * 0.62, h * 0.34)
          drawOutlined(ctx, `Clear Stage ${egg.unlockStage}`, w * 0.58, h * 0.62, h * 0.24, '#ff6b6b', { maxWidth: w * 0.75 })
        } else {
          drawIcon(ctx, isEvent ? 'pumpkin' : 'trophy', w * 0.24, h * 0.62, h * 0.38)
          drawOutlined(ctx, formatNumber(egg.cost), w * 0.58, h * 0.62, h * 0.38, '#ffe14a', { maxWidth: w * 0.6 })
        }
      },
    })
  })
  const ev = EGG_SPOTS[EGGS.findIndex((e) => e.id === 'event')]
  specs.push({ w: 10, h: 2.4, x: ev.x, y: 10.4, z: ev.z, rotY: Math.PI, draw: header('HALLOWEEN', 'pumpkin') })

  // Invite board and like goal.
  specs.push({
    w: 7.5,
    h: 2.2,
    x: INVITE_BOARD.x,
    y: 3.4,
    z: INVITE_BOARD.z,
    rotY: faceToward(INVITE_BOARD, SPAWN),
    draw: (ctx, w, h) => {
      drawOutlined(ctx, 'INVITE A FRIEND', w / 2, h * 0.3, h * 0.36, '#ffffff', { maxWidth: w - 6 })
      drawOutlined(ctx, '+5% POWER BONUS', w / 2, h * 0.74, h * 0.3, '#ffcf3a', { maxWidth: w - 6 })
    },
  })
  specs.push({
    w: 6.2,
    h: 4.6,
    x: LIKE_BOARD.x,
    y: 2.6,
    z: LIKE_BOARD.z,
    rotY: Math.PI,
    draw: (ctx, w, h) => {
      panel(ctx, w, h, 'rgba(25,60,30,0.9)')
      drawOutlined(ctx, 'LIKE GOAL', w / 2, h * 0.14, h * 0.13, '#5dff7a')
      drawOutlined(ctx, 'Reach the goal for a CODE!', w / 2, h * 0.32, h * 0.08, '#ffffff', { maxWidth: w - 10 })
      const bx = w * 0.12
      const bw = w * 0.76
      const by = h * 0.45
      const bh = h * 0.16
      roundRect(ctx, bx, by, bw, bh, bh / 2)
      ctx.fillStyle = '#123018'
      ctx.fill()
      roundRect(ctx, bx, by, bw * (LIKE_GOAL.current / LIKE_GOAL.target), bh, bh / 2)
      ctx.fillStyle = '#3ee060'
      ctx.fill()
      drawOutlined(ctx, `${LIKE_GOAL.current}/${LIKE_GOAL.target} LIKES`, w / 2, by + bh / 2, bh * 0.7, '#ffffff')
      drawOutlined(ctx, `USE CODE: ${LIKE_GOAL.code}`, w / 2, h * 0.82, h * 0.11, '#ffe14a', { maxWidth: w - 10 })
    },
  })

  return specs
}

export function LobbySigns() {
  const ready = useCanvasAssets()
  const rebirths = useGame((s) => s.data?.rebirths ?? 0)
  const bestStage = useGame((s) => s.data?.bestStageEver ?? 0)
  const boomerangsOwned = useGame((s) => s.data?.boomerangsOwned ?? 1)
  const ppu = useQuality((s) => s.settings.signPpu)
  const maxSize = useQuality((s) => (s.settings.textureSize >= 512 ? 1024 : 512))

  const [atlas, setAtlas] = useState<SignAtlas | null>(null)
  const atlasRef = useRef<SignAtlas | null>(null)

  useEffect(() => {
    if (!ready) return
    const next = buildSignAtlas(
      buildSpecs({ rebirths, bestStage, boomerangsOwned }),
      ppu,
      maxSize,
      atlasRef.current ?? undefined,
    )
    atlasRef.current = next
    setAtlas(next)
  }, [ready, rebirths, bestStage, boomerangsOwned, ppu, maxSize])

  const material = useMemo(
    () => new MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }),
    [],
  )
  useEffect(() => {
    material.map = atlas?.texture ?? null
    material.needsUpdate = true
  }, [atlas, material])

  useEffect(
    () => () => {
      material.dispose()
    },
    [material],
  )
  // On unmount only: rebuilds reuse and dispose the previous atlas themselves.
  useEffect(
    () => () => {
      atlasRef.current?.texture.dispose()
      atlasRef.current?.geometry.dispose()
      atlasRef.current = null
    },
    [],
  )

  if (!atlas) return null
  return <mesh geometry={atlas.geometry} material={material} renderOrder={2} />
}
