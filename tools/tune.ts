/**
 * Balance tuner: searches the three knobs the design allows us to turn —
 * wall HP growth, rebirth cost base and boomerang costs — to hit the
 * progression time targets. Prints the best values to paste into /shared/config.
 *
 *   npx tsx tune.ts [--evals 400] [--seed 1]
 */

import { BOOMERANGS, REBIRTH, WALL_HP } from '@game/shared'

import { runSimulation } from './sim-core'

const args = process.argv.slice(2)
const arg = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? Number(args[i + 1]) : fallback
}

/** The spec's boomerang price table, used as the shape the tuner scales. */
const BASE_COSTS = BOOMERANGS.map((b) => b.cost)

interface Params {
  earlyGrowth: number
  lateGrowth: number
  taper: number
  rebirthBase: number
  /** Overall boomerang price multiplier. */
  costScale: number
  /** Extra per-tier price growth (1 = keep the table's shape). */
  costTilt: number
}

const BOUNDS: Record<keyof Params, [number, number]> = {
  earlyGrowth: [1.5, 14],
  lateGrowth: [1.2, 3],
  taper: [0.5, 20],
  rebirthBase: [20, 1e6],
  costScale: [0.05, 1000],
  costTilt: [0.85, 1.25],
}

/** Two significant figures: 1234 → 1200, 56789 → 57000. */
export function niceRound(v: number): number {
  if (v < 10) return Math.max(1, Math.round(v))
  const mag = Math.pow(10, Math.floor(Math.log10(v)) - 1)
  return Math.round(v / mag) * mag
}

export function boomerangCosts(p: Params): number[] {
  return BASE_COSTS.map((c, i) => (i === 0 ? 0 : niceRound(c * p.costScale * Math.pow(p.costTilt, i - 1))))
}

function apply(p: Params): void {
  WALL_HP.earlyGrowth = p.earlyGrowth
  WALL_HP.lateGrowth = p.lateGrowth
  WALL_HP.taper = p.taper
  REBIRTH.costBase = niceRound(p.rebirthBase)
  const costs = boomerangCosts(p)
  BOOMERANGS.forEach((b, i) => {
    ;(b as { cost: number }).cost = costs[i]
  })
}

/** Log-distance outside [min, max] (0 inside). */
const miss = (t: number | undefined, min: number, max: number) => {
  if (t === undefined || !Number.isFinite(t)) return 6
  if (t < min) return Math.log(min / t)
  if (t > max) return Math.log(t / max)
  return 0
}

export function score(p: Params): { score: number; detail: string } {
  apply(p)
  const r = runSimulation({ cps: 5, maxHours: 45 })
  const s = r.stageReached
  const parts = {
    s1: miss(s[0], 1, 60),
    s5: miss(s[4], 8 * 60, 12 * 60),
    rb1: miss(r.rebirths[0]?.t, 15 * 60, 25 * 60),
    s10: miss(s[9], 50 * 60, 70 * 60),
    s20: miss(s[19], 6 * 3600, 8 * 3600),
    s30: miss(s[29], 20 * 3600, 30 * 3600),
  }
  const total = Object.values(parts).reduce((a, b) => a + b * b, 0)
  const h = (t?: number) => (t === undefined ? '—' : `${(t / 3600).toFixed(2)}h`)
  return {
    score: total,
    detail: `s1 ${s[0]?.toFixed(0)}s s5 ${h(s[4])} rb1 ${h(r.rebirths[0]?.t)} s10 ${h(s[9])} s20 ${h(s[19])} s30 ${h(s[29])} rebirths ${r.player.rebirths}`,
  }
}

function clampParams(p: Params): Params {
  const out = { ...p }
  for (const k of Object.keys(BOUNDS) as (keyof Params)[]) {
    out[k] = Math.min(Math.max(out[k], BOUNDS[k][0]), BOUNDS[k][1])
  }
  return out
}

function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('tools/tune.ts')

if (isMain) {
  const rand = mulberry(arg('seed', 1))
  const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand())

  let best: Params = {
    earlyGrowth: 6,
    lateGrowth: 1.9,
    taper: 4,
    rebirthBase: 400,
    costScale: 3,
    costTilt: 1,
  }
  let bestScore = score(best)
  console.log('start', bestScore.score.toFixed(4), bestScore.detail)

  let step = 0.35
  const evals = arg('evals', 400)
  for (let i = 0; i < evals; i += 1) {
    const cand = { ...best }
    for (const k of Object.keys(cand) as (keyof Params)[]) {
      // Log-space mutation; additive for the tilt, which lives near 1.
      cand[k] = k === 'costTilt' ? cand[k] + gauss() * step * 0.05 : cand[k] * Math.exp(gauss() * step)
    }
    const c = clampParams(cand)
    const sc = score(c)
    if (sc.score < bestScore.score) {
      best = c
      bestScore = sc
      step = Math.min(0.6, step * 1.15)
      console.log(`#${i} ${sc.score.toFixed(4)} ${sc.detail}`)
    } else {
      step = Math.max(0.02, step * 0.985)
    }
  }

  apply(best)
  console.log('\nBest params:', JSON.stringify(best, null, 2))
  console.log('rebirth costBase:', REBIRTH.costBase)
  console.log('boomerang costs:', JSON.stringify(boomerangCosts(best)))
  console.log('final', bestScore.score.toFixed(4), bestScore.detail)
}
