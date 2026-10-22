import { type StageDef, mulberry32 } from '@game/shared'
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

import { createStudTexture } from '../textures'

/**
 * Procedural wall textures, one look per stage material. Drawn on demand for the
 * stages in view only, and disposed with them — nothing is loaded at startup.
 */

function shade(hex: string, amount: number): string {
  const v = parseInt(hex.slice(1), 16)
  const t = amount > 0 ? 255 : 0
  const k = Math.abs(amount)
  const ch = (s: number) => Math.round(((v >> s) & 0xff) + (t - ((v >> s) & 0xff)) * k)
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`
}

type Painter = (ctx: CanvasRenderingContext2D, s: number, def: StageDef, rand: () => number) => void

const painters: Record<StageDef['pattern'], Painter> = {
  studs: () => {
    /* handled by createStudTexture */
  },
  planks: (ctx, s, def, rand) => {
    const rows = 6
    const h = s / rows
    for (let r = 0; r < rows; r += 1) {
      ctx.fillStyle = shade(def.color, (rand() - 0.5) * 0.18)
      ctx.fillRect(0, r * h, s, h)
      ctx.strokeStyle = shade(def.accent, -0.1)
      ctx.lineWidth = 2
      for (let g = 0; g < 5; g += 1) {
        ctx.beginPath()
        const y = r * h + rand() * h
        ctx.moveTo(0, y)
        ctx.bezierCurveTo(s * 0.3, y + (rand() - 0.5) * 8, s * 0.6, y + (rand() - 0.5) * 8, s, y)
        ctx.globalAlpha = 0.25
        ctx.stroke()
        ctx.globalAlpha = 1
      }
      ctx.fillStyle = shade(def.accent, -0.2)
      ctx.fillRect(0, r * h + h - 3, s, 3)
      const joint = ((r % 2) * 0.5 + 0.25) * s
      ctx.fillRect(joint, r * h, 3, h)
    }
  },
  concrete: (ctx, s, def, rand) => {
    ctx.fillStyle = def.color
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 2600; i += 1) {
      ctx.fillStyle = rand() > 0.5 ? shade(def.color, 0.08) : shade(def.color, -0.1)
      ctx.fillRect(rand() * s, rand() * s, 2, 2)
    }
    ctx.strokeStyle = shade(def.accent, -0.2)
    ctx.globalAlpha = 0.25
    ctx.strokeRect(1, 1, s - 2, s - 2)
    ctx.globalAlpha = 1
  },
  brick: (ctx, s, def) => {
    ctx.fillStyle = def.accent
    ctx.fillRect(0, 0, s, s)
    const rows = 8
    const h = s / rows
    const w = s / 4
    for (let r = 0; r < rows; r += 1) {
      for (let c = -1; c < 5; c += 1) {
        const x = c * w + (r % 2 ? w / 2 : 0)
        ctx.fillStyle = shade(def.color, ((r * 7 + c * 3) % 5) * 0.03 - 0.06)
        ctx.fillRect(x + 3, r * h + 3, w - 6, h - 6)
      }
    }
  },
  cobble: (ctx, s, def, rand) => {
    ctx.fillStyle = def.accent
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 40; i += 1) {
      const x = rand() * s
      const y = rand() * s
      const r = s * (0.06 + rand() * 0.07)
      ctx.fillStyle = shade(def.color, (rand() - 0.5) * 0.3)
      ctx.beginPath()
      ctx.ellipse(x, y, r, r * (0.7 + rand() * 0.3), rand() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
  },
  marble: (ctx, s, def, rand) => {
    ctx.fillStyle = def.color
    ctx.fillRect(0, 0, s, s)
    ctx.strokeStyle = def.accent
    for (let i = 0; i < 9; i += 1) {
      ctx.lineWidth = 1 + rand() * 3
      ctx.globalAlpha = 0.35 + rand() * 0.3
      ctx.beginPath()
      let x = rand() * s
      let y = 0
      ctx.moveTo(x, y)
      while (y < s) {
        x += (rand() - 0.5) * 40
        y += 20 + rand() * 30
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  },
  panels: (ctx, s, def) => {
    ctx.fillStyle = def.color
    ctx.fillRect(0, 0, s, s)
    const n = 2
    const p = s / n
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        const g = ctx.createLinearGradient(i * p, j * p, i * p + p, j * p + p)
        g.addColorStop(0, shade(def.color, 0.18))
        g.addColorStop(1, shade(def.color, -0.15))
        ctx.fillStyle = g
        ctx.fillRect(i * p + 4, j * p + 4, p - 8, p - 8)
        ctx.fillStyle = def.accent
        for (const [dx, dy] of [
          [14, 14],
          [p - 14, 14],
          [14, p - 14],
          [p - 14, p - 14],
        ]) {
          ctx.beginPath()
          ctx.arc(i * p + dx, j * p + dy, 5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
  },
  facets: (ctx, s, def, rand) => {
    const n = 4
    const c = s / n
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) {
        const x = i * c
        const y = j * c
        const cx = x + c * (0.3 + rand() * 0.4)
        const cy = y + c * (0.3 + rand() * 0.4)
        const corners = [
          [x, y],
          [x + c, y],
          [x + c, y + c],
          [x, y + c],
        ]
        for (let k = 0; k < 4; k += 1) {
          const a = corners[k]
          const b = corners[(k + 1) % 4]
          ctx.fillStyle = shade(def.color, (k - 1.5) * 0.12 + (rand() - 0.5) * 0.1)
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.lineTo(a[0], a[1])
          ctx.lineTo(b[0], b[1])
          ctx.fill()
        }
        ctx.strokeStyle = shade(def.accent, 0.3)
        ctx.globalAlpha = 0.5
        ctx.strokeRect(x, y, c, c)
        ctx.globalAlpha = 1
      }
    }
  },
  magma: (ctx, s, def, rand) => {
    ctx.fillStyle = def.color
    ctx.fillRect(0, 0, s, s)
    ctx.strokeStyle = def.accent
    ctx.shadowColor = def.accent
    ctx.shadowBlur = 12
    for (let i = 0; i < 14; i += 1) {
      ctx.lineWidth = 2 + rand() * 4
      ctx.beginPath()
      let x = rand() * s
      let y = rand() * s
      ctx.moveTo(x, y)
      for (let k = 0; k < 5; k += 1) {
        x += (rand() - 0.5) * 90
        y += (rand() - 0.5) * 90
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.shadowBlur = 0
  },
  frost: (ctx, s, def, rand) => {
    ctx.fillStyle = def.color
    ctx.fillRect(0, 0, s, s)
    ctx.strokeStyle = '#ffffff'
    for (let i = 0; i < 18; i += 1) {
      const x = rand() * s
      const y = rand() * s
      const r = 10 + rand() * 30
      ctx.globalAlpha = 0.35 + rand() * 0.4
      ctx.lineWidth = 1.5
      for (let k = 0; k < 6; k += 1) {
        const a = (k / 6) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
  },
  energy: (ctx, s, def, rand) => {
    ctx.fillStyle = def.color
    ctx.fillRect(0, 0, s, s)
    ctx.strokeStyle = def.accent
    ctx.shadowColor = def.accent
    ctx.shadowBlur = 14
    for (let i = 0; i < 8; i += 1) {
      ctx.lineWidth = 3
      ctx.beginPath()
      let x = 0
      let y = rand() * s
      ctx.moveTo(x, y)
      while (x < s) {
        x += 20 + rand() * 30
        y += (rand() - 0.5) * 60
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.shadowBlur = 0
  },
  stars: (ctx, s, def, rand) => {
    ctx.fillStyle = def.color
    ctx.fillRect(0, 0, s, s)
    for (let i = 0; i < 6; i += 1) {
      const g = ctx.createRadialGradient(rand() * s, rand() * s, 0, rand() * s, rand() * s, s * 0.4)
      g.addColorStop(0, def.accent)
      g.addColorStop(1, 'transparent')
      ctx.globalAlpha = 0.35
      ctx.fillStyle = g
      ctx.fillRect(0, 0, s, s)
    }
    ctx.globalAlpha = 1
    for (let i = 0; i < 140; i += 1) {
      ctx.fillStyle = rand() > 0.8 ? def.accent : '#ffffff'
      const r = rand() * 2.2
      ctx.beginPath()
      ctx.arc(rand() * s, rand() * s, r, 0, Math.PI * 2)
      ctx.fill()
    }
  },
}

export function createWallTexture(def: StageDef, size: number): CanvasTexture {
  if (def.pattern === 'studs') {
    return createStudTexture({ base: def.color, alt: shadeHex(def.color, -0.06), studsPerCell: 2, size }) as CanvasTexture
  }
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  painters[def.pattern](ctx, size, def, mulberry32(def.stage * 7919))
  const t = new CanvasTexture(canvas)
  t.colorSpace = SRGBColorSpace
  t.wrapS = RepeatWrapping
  t.wrapT = RepeatWrapping
  t.anisotropy = 4
  return t
}

function shadeHex(hex: string, amount: number): string {
  const m = shade(hex, amount).match(/\d+/g)!.map(Number)
  return `#${m.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

let crackTexture: CanvasTexture | null = null

/** Shared black crack decal (transparent background) for the damaged wall. */
export function getCrackTexture(): CanvasTexture {
  if (crackTexture) return crackTexture
  const s = 512
  const canvas = document.createElement('canvas')
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext('2d')!
  const rand = mulberry32(42)
  ctx.strokeStyle = 'rgba(20,16,24,0.9)'
  ctx.lineCap = 'round'
  const branch = (x: number, y: number, angle: number, len: number, width: number, depth: number) => {
    if (depth <= 0 || len < 6) return
    const nx = x + Math.cos(angle) * len
    const ny = y + Math.sin(angle) * len
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(nx, ny)
    ctx.stroke()
    branch(nx, ny, angle + (rand() - 0.5) * 0.9, len * 0.8, width * 0.75, depth - 1)
    if (rand() > 0.45) branch(nx, ny, angle + (rand() > 0.5 ? 1 : -1) * (0.6 + rand() * 0.6), len * 0.6, width * 0.6, depth - 2)
  }
  for (let i = 0; i < 9; i += 1) branch(s / 2, s / 2, (i / 9) * Math.PI * 2 + rand() * 0.4, 70 + rand() * 40, 6, 6)
  crackTexture = new CanvasTexture(canvas)
  crackTexture.colorSpace = SRGBColorSpace
  return crackTexture
}
