import {
  BOOMERANG_SPOTS,
  BOOMERANGS,
  EGG_SPOTS,
  EGGS,
  formatNumber,
  INVITE_BOARD,
  isPadOwned,
  LIKE_BOARD,
  LIKE_GOAL,
  REBIRTH_STATUE,
  SPAWN,
  TRAILS_STALL,
  TRAINING_PAD_SPOTS,
  TRAINING_PADS,
  VIP_BOOMERANG,
  VIP_DISPLAY,
} from '@game/shared'
import { useEffect, useState } from 'react'

import { useGame } from '../../state/gameStore'
import { useQuality } from '../../state/qualityStore'
import {
  drawIcon,
  drawOutlined,
  ensureFont,
  fitSize,
  preloadImages,
  REBIRTH_ICON,
  roundRect,
  setFont,
  vGradient,
} from '../canvasText'
import { SignPagesMesh } from '../SignPagesMesh'
import { buildSignPages, type SignPage, type SignSpec } from '../signs'
import { displayStart } from './boomerangDisplay'

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
  trainingPads: number
  bestStage: number
  boomerangsOwned: number
  vip: boolean
}

function buildSpecs({ rebirths, trainingPads, bestStage, boomerangsOwned, vip }: SignInputs): SignSpec[] {
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
    const locked = !isPadOwned(pad.id, trainingPads)
    specs.push({
      w: 3.6,
      h: 2.3,
      x: s.dummy.x + 0.3,
      y: 6.3,
      z: s.dummy.z,
      rotY: Math.PI / 2,
      draw: (ctx, w, h) => {
        panel(ctx, w, h, locked ? 'rgba(90,16,22,0.78)' : 'rgba(20,20,28,0.72)')
        if (locked) {
          // Price in Wins: trophy + amount, centred together.
          const price = formatNumber(pad.cost)
          const size = fitSize(ctx, price, h * 0.42, w * 0.6)
          setFont(ctx, size)
          const icon = h * 0.36
          const gap = icon * 0.15
          const left = w / 2 - (icon + gap + ctx.measureText(price).width) / 2
          drawIcon(ctx, 'trophy', left + icon / 2, h * 0.36, icon)
          drawOutlined(ctx, price, left + icon + gap, h * 0.36, size, '#ffd21f', { align: 'left' })
        } else {
          drawOutlined(ctx, pad.cost === 0 ? 'FREE' : 'OWNED', w / 2, h * 0.36, h * 0.42, vGradient(ctx, h * 0.15, h * 0.55, '#d8ff5a', '#3ee060'))
        }
        drawOutlined(ctx, `x${pad.mult} Power`, w / 2, h * 0.76, h * 0.25, '#ffe14a', { maxWidth: w - 10 })
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

  // Boomerang Stage: a header, then "+Power / price / name" over every display.
  specs.push({ w: 18, h: 3.6, x: 43.6, y: 9.5, z: 33, rotY: -Math.PI / 2, draw: header('BOOMERANGS', 'bolt') })
  const start = displayStart(boomerangsOwned)
  BOOMERANG_SPOTS.forEach((p, i) => {
    const b = BOOMERANGS[start + i]
    if (!b) return
    const owned = b.id < boomerangsOwned
    const isNext = b.id === boomerangsOwned
    specs.push({
      // A low plaque at the front of each pad; the boomerang floats just above it.
      w: 3.2,
      h: 1.7,
      x: p.x - 1.4,
      y: p.y + 1.05,
      z: p.z,
      rotY: -Math.PI / 2,
      draw: (ctx, w, h) => {
        drawOutlined(ctx, `+${formatNumber(b.power)} Power`, w / 2, h * 0.2, h * 0.27, '#5fd3ff', { maxWidth: w - 6 })
        if (owned) {
          drawOutlined(ctx, 'OWNED', w / 2, h * 0.53, h * 0.3, '#9cff6b', { maxWidth: w - 6 })
        } else {
          drawIcon(ctx, 'trophy', w * 0.2, h * 0.53, h * 0.3)
          drawOutlined(ctx, `${formatNumber(b.cost)} WINS`, w * 0.58, h * 0.53, h * 0.3, isNext ? '#ffe14a' : '#ffb35c', {
            maxWidth: w * 0.72,
          })
        }
        drawOutlined(ctx, b.name, w / 2, h * 0.85, h * 0.22, isNext ? '#ffffff' : '#dfe3ee', { maxWidth: w - 6 })
      },
    })
  })
  specs.push({
    w: 6.4,
    h: 2.6,
    x: VIP_DISPLAY.x,
    y: VIP_DISPLAY.y + 6.4,
    z: VIP_DISPLAY.z,
    rotY: -Math.PI / 2,
    draw: (ctx, w, h) => {
      drawOutlined(ctx, 'VIP BOOMERANG', w / 2, h * 0.28, h * 0.34, vGradient(ctx, h * 0.1, h * 0.45, '#fff3a0', '#ffb300'), {
        maxWidth: w - 6,
      })
      drawOutlined(ctx, `Always ${Math.round((VIP_BOOMERANG.multiplier - 1) * 100)}% stronger than your best!`, w / 2, h * 0.62, h * 0.15, '#ffffff', {
        maxWidth: w - 8,
      })
      drawOutlined(ctx, vip ? 'OWNED' : 'Find it in the Halloween Egg!', w / 2, h * 0.86, h * 0.16, vip ? '#9cff6b' : '#ff8ae2', {
        maxWidth: w - 8,
      })
    },
  })

  // Trails stall.
  specs.push({ w: 8, h: 2, x: TRAILS_STALL.x, y: 6.4, z: TRAILS_STALL.z + 1.4, rotY: 0, draw: header('TRAILS', 'bolt') })

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
      rotY: faceToward(spot, SPAWN),
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
  specs.push({ w: 10, h: 2.4, x: ev.x, y: 10.4, z: ev.z, rotY: faceToward(ev, SPAWN), draw: header('HALLOWEEN', 'pumpkin') })

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
  const trainingPads = useGame((s) => s.data?.trainingPads ?? 1)
  const bestStage = useGame((s) => s.data?.bestStageEver ?? 0)
  const boomerangsOwned = useGame((s) => s.data?.boomerangsOwned ?? 1)
  const vip = useGame((s) => s.data?.vipBoomerang ?? false)
  const ppu = useQuality((s) => s.settings.signPpu)
  // LOW pages stay 512² (one page per area of text costs one draw call).
  const pageSize = useQuality((s) => (s.settings.textureSize >= 512 ? 1024 : 512))
  const [pages, setPages] = useState<SignPage[] | null>(null)

  // Painting ~50 outlined-text signs is slow on a phone CPU, so the first atlas
  // waits until the player has joined and the browser is idle (time to playable);
  // later rebuilds (a purchase, a rebirth) happen right away.
  const joined = useGame((s) => s.data !== null)
  const [deferDone, setDeferDone] = useState(false)
  useEffect(() => {
    if (!ready || !joined || deferDone) return
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    if (w.requestIdleCallback) w.requestIdleCallback(() => setDeferDone(true), { timeout: 1500 })
    else window.setTimeout(() => setDeferDone(true), 300)
  }, [ready, joined, deferDone])

  useEffect(() => {
    if (!deferDone) return
    setPages(buildSignPages(buildSpecs({ rebirths, trainingPads, bestStage, boomerangsOwned, vip }), ppu, pageSize))
  }, [deferDone, rebirths, trainingPads, bestStage, boomerangsOwned, vip, ppu, pageSize])

  if (!pages) return null
  return <SignPagesMesh pages={pages} transparent renderOrder={2} />
}
