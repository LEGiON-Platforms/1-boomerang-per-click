import { BOOMERANGS, type BoomerangDef, type BoomerangPattern, type BoomerangShape, VIP_BOOMERANG } from '@game/shared'

/**
 * Boomerang silhouettes, defined once as outline commands and turned into both
 * the 3D extrusion (game/boomerangModel.ts) and the SVG shop icon (ui/icons.tsx).
 * Plain data — no three.js here, so the HUD can import it cheaply.
 *
 * Coordinates: x right, y up, about 1.7 units tip to tip.
 */

export type OutlineCmd = readonly ['M' | 'L', number, number] | readonly ['Q', number, number, number, number]

/** A circle in outline space: [x, y, radius]. */
export type Circle = readonly [number, number, number]

export interface ShapeDef {
  outline: readonly OutlineCmd[]
  /** Accent caps at the tips (the `tips` and `bands` patterns). */
  tips: readonly Circle[]
  /** The gem at the elbow / hub. */
  gem: Circle
  /** The accent plate of the `core` pattern. */
  core: Circle
}

const polar = (angle: number, r: number): [number, number] => [Math.cos(angle) * r, Math.sin(angle) * r]

interface RadialOptions {
  arms: number
  /** Angle of the first arm (radians). */
  start: number
  /** Distance from the hub to the centre of each tip. */
  reach: number
  /** Radius of the notches between arms. */
  valley: number
  /** Half-width of an arm at its tip. */
  width: number
  /** How far the tips lean around the hub (radians) — gives the spin a direction. */
  sweep: number
  /** 1 = round tip, larger = pointed. */
  point: number
}

/** Tri-blade, cross and star outlines: `arms` swept arms around a hub, counter-clockwise. */
function radial(o: RadialOptions): ShapeDef {
  const outline: OutlineCmd[] = []
  const tips: Circle[] = []
  const gap = Math.PI / o.arms
  const mid = (o.valley + o.reach) * 0.52
  for (let k = 0; k < o.arms; k += 1) {
    const a = o.start + (k * Math.PI * 2) / o.arms
    const ta = a + o.sweep
    const [cx, cy] = polar(ta, o.reach)
    const dx = Math.cos(ta)
    const dy = Math.sin(ta)
    const w = o.width
    const rightX = cx + dy * w
    const rightY = cy - dx * w
    const leftX = cx - dy * w
    const leftY = cy + dx * w
    const endX = cx + dx * w * o.point
    const endY = cy + dy * w * o.point
    if (k === 0) outline.push(['M', ...polar(a - gap, o.valley)])
    outline.push(['Q', ...polar(a - gap * 0.4 + o.sweep * 0.6, mid), rightX, rightY])
    outline.push(['Q', rightX + dx * w, rightY + dy * w, endX, endY])
    outline.push(['Q', leftX + dx * w, leftY + dy * w, leftX, leftY])
    outline.push(['Q', ...polar(a + gap * 0.4 + o.sweep * 0.6, mid), ...polar(a + gap, o.valley)])
    tips.push([cx, cy, w + 0.07])
  }
  return { outline, tips, gem: [0, 0, 0.12], core: [0, 0, o.valley + 0.14] }
}

export const SHAPES: Record<BoomerangShape, ShapeDef> = {
  // The classic V: straight chunky arms, a rounded elbow, round tips.
  classic: {
    outline: [
      ['M', -0.86, -0.5],
      ['Q', -1.0, -0.36, -0.86, -0.22],
      ['Q', -0.5, 0.12, -0.2, 0.4],
      ['Q', 0, 0.56, 0.2, 0.4],
      ['Q', 0.5, 0.12, 0.86, -0.22],
      ['Q', 1.0, -0.36, 0.86, -0.5],
      ['Q', 0.4, -0.2, 0.1, 0.04],
      ['Q', 0, 0.1, -0.1, 0.04],
      ['Q', -0.4, -0.2, -0.86, -0.5],
    ],
    tips: [
      [-0.84, -0.36, 0.18],
      [0.84, -0.36, 0.18],
    ],
    gem: [0, 0.26, 0.11],
    core: [0, 0.26, 0.32],
  },
  // Hunting boomerang: one long arm, one short hooked arm.
  hook: {
    outline: [
      ['M', -0.52, -0.6],
      ['Q', -0.78, -0.58, -0.76, -0.36],
      ['Q', -0.68, 0.36, -0.12, 0.44],
      ['Q', 0.48, 0.44, 0.92, 0],
      ['Q', 1.04, -0.14, 0.9, -0.26],
      ['Q', 0.42, -0.06, -0.1, 0],
      ['Q', -0.4, -0.06, -0.52, -0.6],
    ],
    tips: [
      [-0.64, -0.48, 0.17],
      [0.88, -0.13, 0.17],
    ],
    gem: [-0.12, 0.22, 0.11],
    core: [-0.12, 0.22, 0.32],
  },
  // Crescent blade with sharp points and a fin on its back.
  scythe: {
    outline: [
      ['M', -0.98, -0.4],
      ['Q', -0.66, 0.46, -0.14, 0.48],
      ['L', 0, 0.66],
      ['L', 0.14, 0.48],
      ['Q', 0.66, 0.46, 0.98, -0.4],
      ['Q', 0.54, 0.02, 0, 0.04],
      ['Q', -0.54, 0.02, -0.98, -0.4],
    ],
    tips: [
      [-0.82, -0.22, 0.18],
      [0.82, -0.22, 0.18],
    ],
    gem: [0, 0.27, 0.11],
    core: [0, 0.27, 0.3],
  },
  tri: radial({ arms: 3, start: Math.PI / 2, reach: 0.66, valley: 0.26, width: 0.19, sweep: 0.22, point: 1 }),
  cross: radial({ arms: 4, start: Math.PI / 4, reach: 0.68, valley: 0.24, width: 0.16, sweep: 0.12, point: 1.2 }),
  star: radial({ arms: 5, start: Math.PI / 2, reach: 0.7, valley: 0.34, width: 0.13, sweep: 0.3, point: 2 }),
}

export const SHAPE_KEYS = Object.keys(SHAPES) as BoomerangShape[]

/** Pattern ids as the boomerang shader reads them. */
export const PATTERN_CODE: Record<BoomerangPattern, number> = {
  plain: 0,
  tips: 1,
  bands: 2,
  stripes: 3,
  grain: 4,
  core: 5,
  split: 6,
  rainbow: 7,
}

/** Glowing tiers carry a gem at the elbow. */
export const hasGem = (b: Pick<BoomerangDef, 'glow'>) => b.glow >= 0.15

/** Everything a renderer needs to draw one boomerang; shared objects, never mutated. */
export interface BoomerangLook {
  name: string
  color: string
  accent: string
  /** Colours as 0xRRGGBB so frame loops never parse strings. */
  hex: number
  accentHex: number
  glow: number
  shape: BoomerangShape
  /** Index into SHAPE_KEYS. */
  shapeIndex: number
  pattern: BoomerangPattern
  gem: boolean
  /** Pattern code + 8 when it has a gem (the shader's `instanceLook.y`). */
  style: number
}

const hex = (s: string) => parseInt(s.slice(1), 16)

function toLook(b: Pick<BoomerangDef, 'name' | 'color' | 'accent' | 'glow' | 'shape' | 'pattern'>, gem: boolean): BoomerangLook {
  return {
    name: b.name,
    color: b.color,
    accent: b.accent,
    hex: hex(b.color),
    accentHex: hex(b.accent),
    glow: b.glow,
    shape: b.shape,
    shapeIndex: SHAPE_KEYS.indexOf(b.shape),
    pattern: b.pattern,
    gem,
    style: PATTERN_CODE[b.pattern] + (gem ? 8 : 0),
  }
}

const LOOKS = BOOMERANGS.map((b) => toLook(b, hasGem(b)))
const VIP_LOOK = toLook(VIP_BOOMERANG, true)

/** Look of boomerang `id` (clamped), or the VIP one. */
export function boomerangLook(id: number, vip = false): BoomerangLook {
  if (vip) return VIP_LOOK
  return LOOKS[Math.min(Math.max(id, 0), LOOKS.length - 1)]
}

/* ---------------------------------------------------------------------------
 * SVG
 * ------------------------------------------------------------------------- */

const r3 = (v: number) => Math.round(v * 1000) / 1000

export interface SvgShape {
  /** Outline path data (y flipped to point down). */
  path: string
  /** Square viewBox around the outline, with room for the stroke. */
  viewBox: string
  /** Centre of the outline; the `split` pattern divides at centerX. */
  centerX: number
  centerY: number
  /** Circles in SVG space (y flipped). */
  tips: readonly Circle[]
  gem: Circle
  core: Circle
}

const svgCache = new Map<BoomerangShape, SvgShape>()

const flip = (c: Circle): Circle => [c[0], -c[1], c[2]]

export function svgShape(shape: BoomerangShape): SvgShape {
  let out = svgCache.get(shape)
  if (out) return out
  const def = SHAPES[shape]
  const xs: number[] = []
  const ys: number[] = []
  const path =
    def.outline
      .map((c) => {
        if (c[0] === 'Q') {
          xs.push(c[1], c[3])
          ys.push(-c[2], -c[4])
          return `Q${r3(c[1])} ${r3(-c[2])} ${r3(c[3])} ${r3(-c[4])}`
        }
        xs.push(c[1])
        ys.push(-c[2])
        return `${c[0]}${r3(c[1])} ${r3(-c[2])}`
      })
      .join('') + 'Z'
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const side = Math.max(maxX - minX, maxY - minY) + 0.16
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  out = {
    path,
    viewBox: `${r3(cx - side / 2)} ${r3(cy - side / 2)} ${r3(side)} ${r3(side)}`,
    centerX: cx,
    centerY: cy,
    tips: def.tips.map(flip),
    gem: flip(def.gem),
    core: flip(def.core),
  }
  svgCache.set(shape, out)
  return out
}
