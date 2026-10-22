import { useFrame } from '@react-three/fiber'
import { levelForXp, MAX_CLIENTS, type TrailStyle, TRAILS } from '@game/shared'
import { useEffect, useMemo } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  MeshBasicMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three'

import { remoteList } from '../../net/remote'
import { game } from '../../state/gameStore'
import { useQuality } from '../../state/qualityStore'
import { localPlayer, now } from '../runtime'
import { pathPosition, type Projectile, PROJECTILE_CAPACITY, projectiles } from './projectiles'

/**
 * Glowing trails: along every thrown boomerang's path (out and back, with an aura
 * round the boomerang) and behind walking players, fading over WALK_LIFE seconds.
 * Each shop trail has its own look (LOOKS) — width, halo, waves, electric zaps,
 * helix strands, flames, rainbow or aurora colours, sparkles, bubbles — yet
 * everything is written into ONE preallocated dynamic geometry each frame, so all
 * trails together are a single draw call.
 *
 * Strips are camera-facing and five vertices wide (clear edge, coloured halo, a
 * whitish core, halo, clear edge), so they glow without any texture. A boomerang's
 * trail is sampled from its known flight curve, so it is smooth at any frame rate.
 */

interface Look {
  /** Half-width at the head (m). */
  width: number
  /** Opacity of the coloured halo either side of the core (0..1). */
  halo: number
  /** Narrowing towards the tail (0 = none, 1 = to a point). */
  taper: number
  /** Share of the flight (0..1) the boomerang's trail covers. */
  span: number
  /** Sideways wave: amplitude (m) and waves along the trail. */
  wave: number
  waveFreq: number
  /** Jagged electric offsets (m), re-rolled 20 times a second. */
  zap: number
  /** Strands twisting round the path (0 = none), their radius (m), and whether the centre strip stays. */
  strands: number
  helixR: number
  core: boolean
  /** Width flicker (0..1) and tails rising like flames (m). */
  flicker: number
  rise: number
  /** Colour along the trail: gradient head → tail, rainbow, or an aurora shimmer. */
  hue: 'gradient' | 'rainbow' | 'aurora'
  /** Brightness bands running along the trail (0..1). */
  pulse: number
  /** Twinkling stars and bubble rings dotted along the trail. */
  sparkles: number
  bubbles: number
  /** Aura radius round the flying boomerang (m). */
  aura: number
}

const BASE: Look = {
  width: 0.3,
  halo: 0.5,
  taper: 0.7,
  span: 0.32,
  wave: 0,
  waveFreq: 2,
  zap: 0,
  strands: 0,
  helixR: 0,
  core: true,
  flicker: 0,
  rise: 0,
  hue: 'gradient',
  pulse: 0,
  sparkles: 0,
  bubbles: 0,
  aura: 0.5,
}

const LOOKS: Record<TrailStyle, Look> = {
  breeze: { ...BASE, width: 0.22, halo: 0.5, taper: 0.85, span: 0.28, wave: 0.1, waveFreq: 1.5, aura: 0.4 },
  bubbles: { ...BASE, width: 0.28, halo: 0.55, bubbles: 5, aura: 0.55 },
  zap: { ...BASE, width: 0.13, halo: 0.3, taper: 0.3, zap: 0.24, flicker: 0.3, aura: 0.6 },
  wave: { ...BASE, width: 0.26, halo: 0.55, taper: 0.55, span: 0.34, wave: 0.32, waveFreq: 2.5, pulse: 0.4, aura: 0.55 },
  comet: { ...BASE, width: 0.6, halo: 0.5, taper: 1, span: 0.42, aura: 0.9 },
  helix: { ...BASE, width: 0.11, halo: 0.45, taper: 0.35, span: 0.34, strands: 2, helixR: 0.34, core: false, aura: 0.6 },
  sparkle: { ...BASE, width: 0.26, halo: 0.5, sparkles: 6, aura: 0.65 },
  flame: { ...BASE, width: 0.42, halo: 0.6, taper: 0.5, flicker: 0.55, rise: 0.7, aura: 0.85 },
  aurora: { ...BASE, width: 0.62, halo: 0.7, taper: 0.45, span: 0.38, wave: 0.2, waveFreq: 1.2, hue: 'aurora', aura: 0.65 },
  nebula: { ...BASE, width: 0.72, halo: 0.45, taper: 0.55, span: 0.36, pulse: 0.6, sparkles: 4, aura: 0.95 },
  rainbow: { ...BASE, width: 0.38, halo: 0.65, taper: 0.45, span: 0.38, hue: 'rainbow', aura: 0.75 },
  cosmic: { ...BASE, width: 0.17, halo: 0.5, taper: 0.4, span: 0.4, strands: 2, helixR: 0.4, hue: 'rainbow', sparkles: 5, aura: 1.05 },
}

const TRAIL_LOOKS = TRAILS.map((t) => LOOKS[t.style])
const HEADS = TRAILS.map((t) => new Color(t.colors[0]))
const TAILS = TRAILS.map((t) => new Color(t.colors[1]))
const GLOWS = TRAILS.map((t) => new Color(t.glow))

/** How long a walking trail lingers (s), and its sampling. */
const WALK_LIFE = 2
const WALK_N = 34
const WALK_DT = WALK_LIFE / (WALK_N - 2)
/** Height of the walking trail above the feet (m). */
const WALK_Y = 0.55
/** The glowing footpath on the floor: lift (clear of the studs) and half-width (m). */
const PATH_LIFT = 0.08
const PATH_HALF_WIDTH = 0.42
/** Trails further than this from the camera are skipped. */
const CULL_DIST_SQ = 90 * 90

const MAX_VERTS = 26000
const MAX_INDEX = 100000
const MAX_PTS = WALK_N + 2

/** Strip cross-section: offsets across the width, halo alpha slots, whiteness. */
const OFF = [-1, -0.42, 0, 0.42, 1]
const WHITE = [0, 0.06, 0.45, 0.06, 0]
/** Boomerang trails are seen from further away than walking trails: drawn wider. */
const FLIGHT_WIDTH = 1.7

// Per-strip scratch (reused every frame — nothing is allocated in the frame loop).
const PX = new Float32Array(MAX_PTS)
const PY = new Float32Array(MAX_PTS)
const PZ = new Float32Array(MAX_PTS)
const QX = new Float32Array(MAX_PTS)
const QY = new Float32Array(MAX_PTS)
const QZ = new Float32Array(MAX_PTS)
const NX = new Float32Array(MAX_PTS)
const NZ = new Float32Array(MAX_PTS)
const KK = new Float32Array(MAX_PTS)
const KW = new Float32Array(MAX_PTS)
const KA = new Float32Array(MAX_PTS)
const KR = new Float32Array(MAX_PTS)
const KG = new Float32Array(MAX_PTS)
const KB = new Float32Array(MAX_PTS)

const _p = new Vector3()
const _right = new Vector3()
const _up = new Vector3()
const _c = new Color()
const cam = { x: 0, y: 0, z: 0 }

const hash = (a: number, b: number): number => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** The one dynamic glow geometry. Vertices are packed from 0 each frame; only the used part uploads. */
class GlowMesh {
  readonly geometry = new BufferGeometry()
  private readonly pos = new Float32Array(MAX_VERTS * 3)
  private readonly col = new Uint8ClampedArray(MAX_VERTS * 4)
  private readonly idx = new Uint16Array(MAX_INDEX)
  private readonly posAttr = new BufferAttribute(this.pos, 3)
  private readonly colAttr = new BufferAttribute(this.col, 4, true)
  private readonly idxAttr = new BufferAttribute(this.idx, 1)
  // Reused update ranges (three.js clears the list after each upload).
  private readonly posRange = { start: 0, count: 0 }
  private readonly colRange = { start: 0, count: 0 }
  private readonly idxRange = { start: 0, count: 0 }
  v = 0
  i = 0

  constructor() {
    this.posAttr.setUsage(DynamicDrawUsage)
    this.colAttr.setUsage(DynamicDrawUsage)
    this.idxAttr.setUsage(DynamicDrawUsage)
    this.geometry.setAttribute('position', this.posAttr)
    this.geometry.setAttribute('color', this.colAttr)
    this.geometry.setIndex(this.idxAttr)
    this.geometry.setDrawRange(0, 0)
  }

  room(verts: number, indices: number): boolean {
    return this.v + verts <= MAX_VERTS && this.i + indices <= MAX_INDEX
  }

  vert(x: number, y: number, z: number, r: number, g: number, b: number, a: number): void {
    const v = this.v++
    const P = this.pos
    const C = this.col
    P[v * 3] = x
    P[v * 3 + 1] = y
    P[v * 3 + 2] = z
    C[v * 4] = r * 255
    C[v * 4 + 1] = g * 255
    C[v * 4 + 2] = b * 255
    C[v * 4 + 3] = a * 255
  }

  tri(a: number, b: number, c: number): void {
    const I = this.idx
    I[this.i++] = a
    I[this.i++] = b
    I[this.i++] = c
  }

  begin(): void {
    this.v = 0
    this.i = 0
  }

  end(): void {
    this.geometry.setDrawRange(0, this.i)
    if (this.i === 0) return
    this.posRange.count = this.v * 3
    this.colRange.count = this.v * 4
    this.idxRange.count = this.i
    this.posAttr.updateRanges.push(this.posRange)
    this.colAttr.updateRanges.push(this.colRange)
    this.idxAttr.updateRanges.push(this.idxRange)
    this.posAttr.needsUpdate = true
    this.colAttr.needsUpdate = true
    this.idxAttr.needsUpdate = true
  }
}

/** A camera-facing glow strip through points 0..n-1 of (X, Y, Z), using the KW/KA/KR.. scratch. */
function strip(m: GlowMesh, X: Float32Array, Y: Float32Array, Z: Float32Array, n: number, halo: number, widthMul: number): void {
  if (n < 2 || !m.room(n * 5, (n - 1) * 24)) return
  const base = m.v
  for (let s = 0; s < n; s += 1) {
    const j = s < n - 1 ? s : s - 1
    const dx = X[j] - X[j + 1]
    const dy = Y[j] - Y[j + 1]
    const dz = Z[j] - Z[j + 1]
    const vx = cam.x - X[s]
    const vy = cam.y - Y[s]
    const vz = cam.z - Z[s]
    let sx = dy * vz - dz * vy
    let sy = dz * vx - dx * vz
    let sz = dx * vy - dy * vx
    const len = Math.sqrt(sx * sx + sy * sy + sz * sz)
    const w = KW[s] * widthMul
    if (len > 1e-6) {
      sx *= w / len
      sy *= w / len
      sz *= w / len
    } else sx = sy = sz = 0
    const a = KA[s]
    const r = KR[s]
    const g = KG[s]
    const b = KB[s]
    for (let c = 0; c < 5; c += 1) {
      const o = OFF[c]
      const wf = WHITE[c]
      const ca = c === 2 ? a : c === 0 || c === 4 ? 0 : a * Math.min(1, halo * 1.2)
      m.vert(X[s] + sx * o, Y[s] + sy * o, Z[s] + sz * o, r + (1 - r) * wf, g + (1 - g) * wf, b + (1 - b) * wf, ca)
    }
  }
  for (let s = 0; s < n - 1; s += 1) {
    for (let c = 0; c < 4; c += 1) {
      const a = base + s * 5 + c
      m.tri(a, a + 5, a + 1)
      m.tri(a + 1, a + 5, a + 6)
    }
  }
}

/** A soft camera-facing disc (aura), or a four-pointed star when `star` is set. */
function flare(m: GlowMesh, x: number, y: number, z: number, radius: number, r: number, g: number, b: number, a: number, star: boolean, spin: number): void {
  const RAYS = 8
  if (!m.room(RAYS + 1, RAYS * 3)) return
  const base = m.v
  m.vert(x, y, z, r + (1 - r) * 0.6, g + (1 - g) * 0.6, b + (1 - b) * 0.6, a)
  for (let k = 0; k < RAYS; k += 1) {
    const ang = (k / RAYS) * Math.PI * 2 + spin
    const rad = star && k % 2 === 1 ? radius * 0.3 : radius
    const cx = Math.cos(ang) * rad
    const cy = Math.sin(ang) * rad
    m.vert(x + _right.x * cx + _up.x * cy, y + _right.y * cx + _up.y * cy, z + _right.z * cx + _up.z * cy, r, g, b, 0)
  }
  for (let k = 0; k < RAYS; k += 1) m.tri(base, base + 1 + k, base + 1 + ((k + 1) % RAYS))
}

/** A bubble: clear-ish middle, bright rim, soft outside. */
function bubble(m: GlowMesh, x: number, y: number, z: number, radius: number, r: number, g: number, b: number, a: number): void {
  const RAYS = 8
  if (!m.room(RAYS * 2 + 1, RAYS * 9)) return
  const base = m.v
  m.vert(x, y, z, r, g, b, a * 0.12)
  for (let ring = 0; ring < 2; ring += 1) {
    const rad = ring === 0 ? radius * 0.78 : radius
    const ra = ring === 0 ? a : 0
    for (let k = 0; k < RAYS; k += 1) {
      const ang = (k / RAYS) * Math.PI * 2
      const cx = Math.cos(ang) * rad
      const cy = Math.sin(ang) * rad
      m.vert(x + _right.x * cx + _up.x * cy, y + _right.y * cx + _up.y * cy, z + _right.z * cx + _up.z * cy, r + (1 - r) * 0.4, g + (1 - g) * 0.4, b + (1 - b) * 0.4, ra)
    }
  }
  for (let k = 0; k < RAYS; k += 1) {
    const k1 = (k + 1) % RAYS
    m.tri(base, base + 1 + k, base + 1 + k1)
    m.tri(base + 1 + k, base + 1 + RAYS + k, base + 1 + k1)
    m.tri(base + 1 + k1, base + 1 + RAYS + k, base + 1 + RAYS + k1)
  }
}

/** Ground path cross-section: alpha share, and brightness (core lighter, edges deeper). */
const PATH_ALPHA = [0, 0.7, 1, 0.7, 0]
const PATH_SHADE = [0.8, 0.8, 1.15, 0.8, 0.8]

/**
 * A flat glowing path on the floor through QX/QY/QZ, sideways along NX/NZ, faded
 * like the shaped trail (KA; call after shape()). Pale trail colours vanish on the
 * light floor, so gradient trails use their deeper tail colour here; rainbow and
 * aurora keep their shifting colours (KR/KG/KB).
 */
function groundPath(m: GlowMesh, n: number, halfWidth: number, trail: number, look: Look): void {
  if (n < 2 || !m.room(n * 5, (n - 1) * 24)) return
  const base = m.v
  const tail = TAILS[trail] ?? TAILS[0]
  const head = HEADS[trail] ?? HEADS[0]
  const own = look.hue === 'gradient'
  for (let s = 0; s < n; s += 1) {
    const k = KK[s]
    // Soft start under the feet, narrowing a little towards the tail.
    const w = halfWidth * (1 - k * 0.35)
    const a = KA[s] * Math.min(1, k * 8) * 0.95
    const r = own ? tail.r + (head.r - tail.r) * 0.2 : KR[s]
    const g = own ? tail.g + (head.g - tail.g) * 0.2 : KG[s]
    const b = own ? tail.b + (head.b - tail.b) * 0.2 : KB[s]
    for (let c = 0; c < 5; c += 1) {
      const o = OFF[c] * w
      const sh = PATH_SHADE[c]
      m.vert(QX[s] + NX[s] * o, QY[s], QZ[s] + NZ[s] * o, Math.min(1, r * sh), Math.min(1, g * sh), Math.min(1, b * sh), a * PATH_ALPHA[c])
    }
  }
  for (let s = 0; s < n - 1; s += 1) {
    for (let c = 0; c < 4; c += 1) {
      const a = base + s * 5 + c
      m.tri(a, a + 5, a + 1)
      m.tri(a + 1, a + 5, a + 6)
    }
  }
}

/**
 * Shapes the n centre points in PX/PY/PZ (head first, KK = 0 at the head … 1 at
 * the tail): bends the line (wave, zap, rising flames) and fills width, alpha and
 * colour per point.
 */
function shape(n: number, look: Look, trail: number, t: number, seed: number, widthMul: number, alphaMul: number): void {
  // Horizontal sideways direction per point, before the line is bent.
  for (let s = 0; s < n; s += 1) {
    const j = s < n - 1 ? s : s - 1
    const dx = PX[j] - PX[j + 1]
    const dz = PZ[j] - PZ[j + 1]
    const len = Math.sqrt(dx * dx + dz * dz)
    if (len > 1e-5) {
      NX[s] = dz / len
      NZ[s] = -dx / len
    } else {
      NX[s] = 1
      NZ[s] = 0
    }
  }
  const head = HEADS[trail] ?? HEADS[0]
  const tail = TAILS[trail] ?? TAILS[0]
  const frame = Math.floor(t * 20)
  for (let s = 0; s < n; s += 1) {
    const k = KK[s]
    const grow = Math.min(1, k * 5) // keeps the head on the boomerang / player
    if (look.wave > 0) {
      const off = look.wave * Math.sin(k * look.waveFreq * Math.PI * 2 - t * 7 + seed) * grow
      PX[s] += NX[s] * off
      PZ[s] += NZ[s] * off
    }
    if (look.zap > 0 && s > 0 && s < n - 1) {
      const off = look.zap * (hash(s + seed, frame) - 0.5) * 2 * grow
      PX[s] += NX[s] * off
      PZ[s] += NZ[s] * off
      PY[s] += look.zap * (hash(frame, s - seed) - 0.5) * 1.6 * grow
    }
    if (look.rise > 0) PY[s] += look.rise * k * k
    let w = look.width * (1 - look.taper * k)
    if (look.flicker > 0) w *= 1 + look.flicker * 0.3 * (Math.sin(s * 2.7 + t * 31 + seed) + Math.sin(s * 1.9 - t * 23))
    KW[s] = Math.max(0.01, w * widthMul)
    let a = Math.pow(1 - k, 0.8) * alphaMul
    if (look.pulse > 0) a *= 1 - look.pulse * 0.5 + look.pulse * 0.5 * Math.sin(k * 14 - t * 10 + seed)
    KA[s] = a
    if (look.hue === 'rainbow') {
      _c.setHSL((((k * 0.9 - t * 0.6 + seed) % 1) + 1) % 1, 1, 0.6, SRGBColorSpace)
    } else if (look.hue === 'aurora') {
      _c.lerpColors(head, tail, 0.5 + 0.5 * Math.sin(k * 9 - t * 3 + seed))
    } else _c.lerpColors(head, tail, k)
    KR[s] = _c.r
    KG[s] = _c.g
    KB[s] = _c.b
  }
}

/** Strands, centre strip, sparkles and bubbles for the shaped points. */
function draw(m: GlowMesh, n: number, look: Look, t: number, seed: number, decor: number, widthMul: number): void {
  if (look.strands === 0 || look.core) strip(m, PX, PY, PZ, n, look.halo, look.strands > 0 ? 0.7 : 1)
  for (let st = 0; st < look.strands; st += 1) {
    const phase = (st / look.strands) * Math.PI * 2 + seed
    for (let s = 0; s < n; s += 1) {
      const k = KK[s]
      const ang = k * Math.PI * 5 - t * 9 + phase
      const r = look.helixR * widthMul * Math.min(1, k * 6) * (1 - k * 0.3)
      QX[s] = PX[s] + NX[s] * Math.cos(ang) * r
      QY[s] = PY[s] + Math.sin(ang) * r
      QZ[s] = PZ[s] + NZ[s] * Math.cos(ang) * r
    }
    strip(m, QX, QY, QZ, n, look.halo, 1)
  }
  const sparkles = Math.ceil(look.sparkles * decor)
  const bubbles = Math.ceil(look.bubbles * decor)
  for (let j = 0; j < sparkles + bubbles; j += 1) {
    const isBubble = j >= sparkles
    const u = (((j / (sparkles + bubbles) + t * (isBubble ? 0.35 : 0.5) + seed * 0.13) % 1) + 1) % 1
    const f = u * (n - 1)
    const s0 = Math.floor(f)
    const s1 = Math.min(n - 1, s0 + 1)
    const w = f - s0
    const a = KA[s0] * (1 - u * 0.5)
    if (a < 0.03) continue
    const spread = KW[s0] * 2.2
    const side = (hash(j, seed) - 0.5) * spread
    const x = PX[s0] + (PX[s1] - PX[s0]) * w + NX[s0] * side
    const z = PZ[s0] + (PZ[s1] - PZ[s0]) * w + NZ[s0] * side
    let y = PY[s0] + (PY[s1] - PY[s0]) * w + (hash(seed, j) - 0.5) * spread
    if (isBubble) {
      y += u * 0.7
      bubble(m, x, y, z, (0.1 + u * 0.14) * widthMul, KR[s0], KG[s0], KB[s0], a)
    } else {
      const size = (0.17 + 0.09 * Math.sin(t * 14 + j * 2.3)) * (1 - u * 0.5) * widthMul
      flare(m, x, y, z, size, KR[s0], KG[s0], KB[s0], Math.min(1, a * 1.3), true, t * 3 + j)
    }
  }
}

function boomerangTrail(m: GlowMesh, p: Projectile, segs: number, t: number, decor: number): void {
  const trail = TRAIL_LOOKS[p.trail] ? p.trail : 0
  const look = TRAIL_LOOKS[trail]
  const seed = (p.id % 97) * 0.37
  for (let s = 0; s < segs; s += 1) {
    const k = s / (segs - 1)
    pathPosition(p, Math.max(0, p.t - k * look.span), _p)
    PX[s] = _p.x
    PY[s] = _p.y
    PZ[s] = _p.z
    KK[s] = k
  }
  const dx = PX[0] - cam.x
  const dy = PY[0] - cam.y
  const dz = PZ[0] - cam.z
  const d2 = dx * dx + dy * dy + dz * dz
  if (d2 > CULL_DIST_SQ) return
  // Aura round the boomerang, set just behind it so it never covers the model.
  if (look.aura > 0) {
    const g = GLOWS[trail]
    const d = Math.sqrt(d2) || 1
    const back = 0.45 / d
    const pulse = 1 + 0.12 * Math.sin(t * 16 + seed)
    flare(m, PX[0] + dx * back, PY[0] + dy * back, PZ[0] + dz * back, look.aura * 1.25 * pulse, g.r, g.g, g.b, 0.85, false, 0)
  }
  shape(segs, look, trail, t, seed, FLIGHT_WIDTH, 0.95)
  draw(m, segs, look, t, seed, decor, FLIGHT_WIDTH)
}

/** Where a player has been: one sample every WALK_DT, kept for WALK_LIFE. */
class WalkHistory {
  readonly x = new Float32Array(WALK_N)
  readonly y = new Float32Array(WALK_N)
  readonly z = new Float32Array(WALK_N)
  readonly at = new Float64Array(WALK_N)
  head = -1
  count = 0
  owner = ''

  reset(owner: string): void {
    this.owner = owner
    this.head = -1
    this.count = 0
  }

  sample(x: number, y: number, z: number, t: number): void {
    if (this.count > 0) {
      const h = this.head
      const dx = x - this.x[h]
      const dz = z - this.z[h]
      // Teleported: start over instead of streaking across the map.
      if (dx * dx + dz * dz > 64) this.count = 0
      else if (t - this.at[h] < WALK_DT || dx * dx + dz * dz + (y - this.y[h]) ** 2 < 0.0025) return
    }
    this.head = (this.head + 1) % WALK_N
    this.x[this.head] = x
    this.y[this.head] = y
    this.z[this.head] = z
    this.at[this.head] = t
    this.count = Math.min(WALK_N, this.count + 1)
  }
}

function walkTrail(m: GlowMesh, h: WalkHistory, x: number, y: number, z: number, trail: number, level: number, t: number, decor: number): void {
  h.sample(x, y, z, t)
  if (h.count === 0) return
  const dx = x - cam.x
  const dz = z - cam.z
  if (dx * dx + dz * dz > CULL_DIST_SQ) return
  const tr = TRAIL_LOOKS[trail] ? trail : 0
  const look = TRAIL_LOOKS[tr]
  // Head at the player now, then the samples newest → oldest while younger than WALK_LIFE.
  PX[0] = x
  PY[0] = y + WALK_Y
  PZ[0] = z
  KK[0] = 0
  let n = 1
  let length = 0
  for (let i = 0; i < h.count && n < MAX_PTS; i += 1) {
    const s = (h.head - i + WALK_N) % WALK_N
    const age = t - h.at[s]
    if (age >= WALK_LIFE) break
    PX[n] = h.x[s]
    PY[n] = h.y[s] + WALK_Y
    PZ[n] = h.z[s]
    KK[n] = age / WALK_LIFE
    length += Math.hypot(PX[n] - PX[n - 1], PZ[n] - PZ[n - 1])
    n += 1
  }
  if (n < 2 || length < 0.3) return
  // The footpath follows the real steps: copied before shape() bends the line.
  for (let s = 0; s < n; s += 1) {
    QX[s] = PX[s]
    QY[s] = PY[s] - WALK_Y + PATH_LIFT
    QZ[s] = PZ[s]
  }
  // Higher levels draw a wider, brighter path (visible from level 1).
  const lv = Math.min(1, (level - 1) / 99)
  const widthMul = 1.1 + lv * 0.5
  shape(n, look, tr, t, 0, widthMul, 0.8 + lv * 0.2)
  groundPath(m, n, PATH_HALF_WIDTH * widthMul, tr, look)
  draw(m, n, look, t, 0, length > 2 ? decor : 0, widthMul)
}

function Trails() {
  const glow = useMemo(() => new GlowMesh(), [])
  const walks = useMemo(() => Array.from({ length: MAX_CLIENTS }, () => new WalkHistory()), [])
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        // One pass: three.js would otherwise flip material.side twice a frame.
        forceSinglePass: true,
        toneMapped: false,
      }),
    [],
  )
  useEffect(
    () => () => {
      glow.geometry.dispose()
      material.dispose()
    },
    [glow, material],
  )

  // Local level for the walking trail, recomputed only when XP changes.
  const level = useMemo(() => ({ xp: -1, value: 1 }), [])

  useFrame(({ camera }) => {
    const t = now()
    const q = useQuality.getState()
    const low = q.preset === 'LOW'
    // LOW: shorter strips; everything stays one draw call.
    const segs = low ? 14 : 20
    // LOW draws no particles: sparkle and bubble styles keep just their glowing ribbon.
    const decor = low ? 0 : 1
    cam.x = camera.position.x
    cam.y = camera.position.y
    cam.z = camera.position.z
    _right.setFromMatrixColumn(camera.matrixWorld, 0)
    _up.setFromMatrixColumn(camera.matrixWorld, 1)

    glow.begin()
    for (let i = 0; i < PROJECTILE_CAPACITY; i += 1) {
      const p = projectiles[i]
      // t <= 0: still in the thrower's hand (wind-up) — no trail or aura yet.
      if (p.active && p.t > 0) boomerangTrail(glow, p, segs, t, decor)
    }

    const g = game()
    if (g.data) {
      if (g.xp !== level.xp) {
        level.xp = g.xp
        level.value = levelForXp(g.xp)
      }
      if (walks[0].owner !== 'local') walks[0].reset('local')
      const lp = localPlayer.pos
      walkTrail(glow, walks[0], lp.x, lp.y, lp.z, g.data.equippedTrail, level.value, t, decor)
    }
    // Other players' walking trails: MEDIUM / HIGH only.
    if (q.settings.playerTrails === 'all') {
      for (let r = 1; r < MAX_CLIENTS; r += 1) {
        const rp = remoteList[r - 1]
        if (!rp) continue
        if (walks[r].owner !== rp.sessionId) walks[r].reset(rp.sessionId)
        walkTrail(glow, walks[r], rp.px, rp.py, rp.pz, rp.trail, rp.level || 1, t, decor)
      }
    }
    glow.end()
  })

  return <mesh geometry={glow.geometry} material={material} frustumCulled={false} renderOrder={4} />
}

export function TrailRibbons() {
  return <Trails />
}

export default TrailRibbons
