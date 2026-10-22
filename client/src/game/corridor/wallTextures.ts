import { type StageDef, mulberry32 } from '@game/shared'
import { CanvasTexture, LinearFilter, RepeatWrapping, SRGBColorSpace } from 'three'

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

/** [r, g, b] of a '#rrggbb' or 'rgb(r,g,b)' colour (for per-pixel painting). */
function rgb(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    const v = parseInt(color.slice(1), 16)
    return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]
  }
  const m = color.match(/\d+/g)!.map(Number)
  return [m[0], m[1], m[2]]
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
  // Molten rock: dark cooled-crust plates (a tileable Voronoi) split by glowing seams.
  magma: (ctx, s, def, rand) => {
    const seeds = Array.from({ length: 22 }, () => [rand() * s, rand() * s, rand()] as const)
    const img = ctx.createImageData(s, s)
    const crust = rgb(shade(def.color, -0.62))
    const crustHi = rgb(shade(def.color, -0.4))
    const hot = rgb(def.accent)
    const core = rgb(shade(def.accent, 0.6))
    const wrap = (d: number) => Math.min(Math.abs(d), s - Math.abs(d))
    for (let y = 0; y < s; y += 1) {
      for (let x = 0; x < s; x += 1) {
        let d1 = Infinity
        let d2 = Infinity
        let shadeOf = 0
        for (const [sx, sy, v] of seeds) {
          const dx = wrap(x - sx)
          const dy = wrap(y - sy)
          const d = dx * dx + dy * dy
          if (d < d1) {
            d2 = d1
            d1 = d
            shadeOf = v
          } else if (d < d2) d2 = d
        }
        // Distance to the seam between the two nearest plates (approximate, in px).
        const seam = (Math.sqrt(d2) - Math.sqrt(d1)) / (s / 256)
        const glow = Math.max(0, 1 - seam / 9)
        const hotCore = Math.max(0, 1 - seam / 2.5)
        const i = (y * s + x) * 4
        for (let c = 0; c < 3; c += 1) {
          const plate = crust[c] + (crustHi[c] - crust[c]) * shadeOf * 0.7
          const lit = plate + (hot[c] - plate) * glow * glow
          img.data[i + c] = lit + (core[c] - lit) * hotCore
        }
        img.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
  },
  // Ice blocks: staggered rows of bevelled blocks with white highlights and a few cracks.
  frost: (ctx, s, def, rand) => {
    const rows = 4
    const h = s / rows
    const w = s / 3
    for (let r = 0; r < rows; r += 1) {
      const offset = (r % 2) * (w / 2)
      for (let k = -1; k < 3; k += 1) {
        const x = k * w + offset
        const y = r * h
        const g = ctx.createLinearGradient(x, y, x + w, y + h)
        g.addColorStop(0, shade(def.color, 0.45))
        g.addColorStop(0.55, shade(def.color, (rand() - 0.5) * 0.12))
        g.addColorStop(1, shade(def.color, -0.12))
        ctx.fillStyle = g
        ctx.fillRect(x, y, w, h)
        // Bevel: bright top/left edge, darker bottom/right.
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.fillRect(x, y, w, 3)
        ctx.fillRect(x, y, 3, h)
        ctx.fillStyle = shade(def.accent, -0.15)
        ctx.globalAlpha = 0.6
        ctx.fillRect(x, y + h - 3, w, 3)
        ctx.fillRect(x + w - 3, y, 3, h)
        ctx.globalAlpha = 1
        // A diagonal glint.
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.moveTo(x + w * 0.15, y + h * 0.75)
        ctx.lineTo(x + w * 0.4, y + h * 0.2)
        ctx.stroke()
      }
    }
    ctx.strokeStyle = shade(def.accent, -0.2)
    ctx.globalAlpha = 0.45
    ctx.lineWidth = 1.5
    for (let i = 0; i < 6; i += 1) {
      let x = rand() * s
      let y = rand() * s
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let k = 0; k < 4; k += 1) {
        x += (rand() - 0.5) * 50
        y += (rand() - 0.5) * 50
        ctx.lineTo(x, y)
      }
      ctx.stroke()
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

/** Crack decal canvas size: the wall's 16 : 10 shape. */
const CRACK_W = 512
const CRACK_H = 320

/**
 * The crack network for a damaged wall, covering the whole face. Each crack
 * segment stores *when* it appears in its alpha (alpha = 1 − damage at which it
 * shows), so one texture serves every damage level: the overlay's alphaTest is
 * set to 1 − damage and the cracks spread from a few impact points as the wall's
 * HP drops — no redraws, no per-frame work.
 */
export function getCrackTexture(): CanvasTexture {
  if (crackTexture) return crackTexture
  const canvas = document.createElement('canvas')
  canvas.width = CRACK_W
  canvas.height = CRACK_H
  const ctx = canvas.getContext('2d')!
  const rand = mulberry32(42)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  interface Seg {
    pts: number[]
    width: number
    /** Damage (0..1) at which this segment shows. */
    at: number
  }
  const segs: Seg[] = []
  const branch = (x: number, y: number, angle: number, len: number, width: number, depth: number, at: number) => {
    if (depth <= 0 || len < 10 || at > 0.97) return
    // A jagged run of three short kinks.
    const pts = [x, y]
    let cx = x
    let cy = y
    for (let k = 0; k < 3; k += 1) {
      const a = angle + (rand() - 0.5) * 0.7
      cx += (Math.cos(a) * len) / 3
      cy += (Math.sin(a) * len) / 3
      pts.push(cx, cy)
    }
    segs.push({ pts, width, at })
    const next = at + 0.05 + rand() * 0.07
    branch(cx, cy, angle + (rand() - 0.5) * 0.6, len * 0.85, width * 0.8, depth - 1, next)
    if (rand() > 0.35) branch(cx, cy, angle + (rand() > 0.5 ? 1 : -1) * (0.5 + rand() * 0.7), len * 0.7, width * 0.7, depth - 1, next + 0.04)
  }
  // Impact points open up one after another: the first early, the last near the end.
  const impacts: [number, number, number][] = [
    [0.5, 0.45, 0.04],
    [0.2, 0.3, 0.22],
    [0.8, 0.62, 0.32],
    [0.3, 0.75, 0.45],
    [0.75, 0.22, 0.55],
  ]
  for (const [ix, iy, at] of impacts) {
    const rays = 6 + Math.floor(rand() * 3)
    for (let r = 0; r < rays; r += 1) {
      const angle = (r / rays) * Math.PI * 2 + rand() * 0.5
      branch(ix * CRACK_W, iy * CRACK_H, angle, 34 + rand() * 26, 5.5, 6, at + rand() * 0.06)
    }
  }
  // Each crack's "appears at" is drawn as a grey level and merged with 'lighten'
  // (max), so overlapping cracks keep the earliest one's threshold instead of
  // adding up; the levels are then moved into the alpha channel.
  ctx.globalCompositeOperation = 'lighten'
  for (const seg of segs) {
    const v = Math.round(255 * (1 - seg.at))
    ctx.strokeStyle = `rgb(${v}, ${v}, ${v})`
    ctx.lineWidth = seg.width
    ctx.beginPath()
    ctx.moveTo(seg.pts[0], seg.pts[1])
    for (let i = 2; i < seg.pts.length; i += 2) ctx.lineTo(seg.pts[i], seg.pts[i + 1])
    ctx.stroke()
  }
  const img = ctx.getImageData(0, 0, CRACK_W, CRACK_H)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    // Faint anti-aliased fringes are dropped; covered pixels carry the threshold.
    d[i + 3] = d[i + 3] > 90 ? d[i] : 0
    d[i] = 38
    d[i + 1] = 30
    d[i + 2] = 46
  }
  ctx.putImageData(img, 0, 0)
  crackTexture = new CanvasTexture(canvas)
  crackTexture.colorSpace = SRGBColorSpace
  // Mipmaps would average the stored thresholds; keep them exact.
  crackTexture.generateMipmaps = false
  crackTexture.minFilter = LinearFilter
  return crackTexture
}
