/**
 * Balance tuner: searches the knobs the design allows us to turn — wall HP
 * growth, the XP curve (rebirths are gated by level) and boomerang costs — to hit the
 * progression time targets. Prints the best values to paste into /shared/config.
 *
 *   npx tsx tune.ts [--evals 400] [--seed 1] [--keep-costs]
 *
 * --keep-costs leaves the boomerang prices in /shared/config as they are (a fixed
 * design table) and tunes only wall HP growth and the XP curve.
 */

import { BOOMERANGS, LEVEL, WALL_HP } from '@game/shared'

import { runSimulation } from './sim-core'

const args = process.argv.slice(2)
const keepCosts = args.includes('--keep-costs')
const arg = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? Number(args[i + 1]) : fallback
}

interface Params {
  earlyGrowth: number
  lateGrowth: number
  taper: number
  /** XP curve (see LEVEL): base, then growth tapering early → late. */
  levelBase: number
  levelEarly: number
  levelLate: number
  levelTaper: number
  /** Boomerang prices: cost(i) = exp(costB1·(i−1) + costB2·(i−1)²), so the first costs exactly 1 Win. */
  costB1: number
  costB2: number
}

const BOUNDS: Record<keyof Params, [number, number]> = {
  earlyGrowth: [1.5, 40],
  lateGrowth: [1.2, 3],
  taper: [0.5, 20],
  levelBase: [1, 1e4],
  levelEarly: [1.2, 3],
  levelLate: [1.03, 2],
  levelTaper: [1, 200],
  costB1: [0.05, 1.2],
  costB2: [-0.01, 0.02],
}

/** Two significant figures: 1234 → 1200, 56789 → 57000. */
export function niceRound(v: number): number {
  if (v < 10) return Math.max(1, Math.round(v))
  const mag = Math.pow(10, Math.floor(Math.log10(v)) - 1)
  return Math.round(v / mag) * mag
}

export function boomerangCosts(p: Params): number[] {
  const out = [0]
  for (let i = 1; i < BOOMERANGS.length; i += 1) {
    let c = niceRound(Math.exp(p.costB1 * (i - 1) + p.costB2 * (i - 1) * (i - 1)))
    if (c <= out[i - 1]) c = out[i - 1] + 1
    out.push(c)
  }
  return out
}

function apply(p: Params): void {
  WALL_HP.earlyGrowth = p.earlyGrowth
  WALL_HP.lateGrowth = p.lateGrowth
  WALL_HP.taper = p.taper
  LEVEL.base = niceRound(p.levelBase)
  LEVEL.earlyGrowth = Math.round(p.levelEarly * 1000) / 1000
  LEVEL.lateGrowth = Math.round(p.levelLate * 1000) / 1000
  LEVEL.taper = Math.round(p.levelTaper * 10) / 10
  if (keepCosts) return
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
    // Level-gated rebirths should still come regularly (rebirth-locked pads and pet slots).
    rebirths: miss(r.player.rebirths, 10, 14),
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
    earlyGrowth: 20.57,
    lateGrowth: 1.6,
    taper: 3.22,
    levelBase: 19,
    levelEarly: 2.211,
    levelLate: 1.049,
    levelTaper: 18.2,
    costB1: 0.33,
    costB2: 0.0015,
  }
  let bestScore = score(best)
  console.log('start', bestScore.score.toFixed(4), bestScore.detail)

  let step = 0.35
  const evals = arg('evals', 400)
  for (let i = 0; i < evals; i += 1) {
    const cand = { ...best }
    for (const k of Object.keys(cand) as (keyof Params)[]) {
      if (keepCosts && (k === 'costB1' || k === 'costB2')) continue
      // Log-space mutation; additive for the quadratic term, which can be near zero.
      cand[k] = k === 'costB2' ? cand[k] + gauss() * step * 0.002 : cand[k] * Math.exp(gauss() * step)
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
  console.log('level curve:', JSON.stringify(LEVEL))
  if (!keepCosts) console.log('boomerang costs:', JSON.stringify(boomerangCosts(best)))
  console.log('final', bestScore.score.toFixed(4), bestScore.detail)
}
