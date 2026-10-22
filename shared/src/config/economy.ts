/**
 * Core economy: wall HP, win pads, rebirth, click gain and player level.
 *
 * Every tunable number in the game lives in /shared/config. Client, server and the
 * balance simulator all import these exact functions, so a value changed here
 * changes everywhere at once.
 */

export const STAGE_COUNT = 30
export const WALLS_PER_STAGE = 10

export const WALL_HP = {
  /** HP of stage 1, wall 1. */
  base: 10,
  /**
   * Per-stage growth factor. It tapers from `earlyGrowth` (stage 2) towards
   * `lateGrowth` with a decay of `taper` stages. A single constant can't hit both
   * the early and late time targets — see README "Balance". Tuned by tools/tune.ts.
   */
  earlyGrowth: 20.57,
  lateGrowth: 1.6,
  taper: 3.22,
  /** Each later wall in a stage has +15% of the stage's base HP. */
  perWall: 0.15,
}

/** Wins granted by the single Win Pad at the end of each stage (index 0 = stage 1). */
export const PAD_WINS: readonly number[] = [
  1, 5, 10, 24, 50, 100, 180, 320, 550, 900,
  1_500, 2_400, 3_800, 6_000, 9_500, 15_000, 24_000, 38_000, 60_000, 95_000,
  150_000, 240_000, 380_000, 600_000, 950_000, 1_500_000, 2_400_000, 3_800_000, 6_000_000, 10_000_000,
]

/** Each broken wall also pays this fraction of the stage's pad value (floored). */
export const WALL_BREAK_WIN_FRACTION = 0.05

export const REBIRTH = {
  /** Rebirth n needs player level n × levelStep: 15, 30, 45, … (no Wins cost). */
  levelStep: 15,
}

export const THROW = {
  /** Server-side hard cap, auto-throw included. */
  maxPerSecond: 12,
  /** Auto-throw rate once unlocked (free at rebirth 1). */
  autoPerSecond: 4,
  /** Rebirths needed to unlock auto-throw. */
  autoUnlockRebirths: 1,
  /** How far ahead (world units) a throw can reach a wall. */
  range: 26,
  /** Seconds for the out-and-back flight (visual only). */
  flightTime: 0.6,
} as const

/** Growth factor from stage s-1 to stage s. */
export function stageGrowth(stage: number): number {
  const { earlyGrowth, lateGrowth, taper } = WALL_HP
  return lateGrowth + (earlyGrowth - lateGrowth) * Math.exp(-(stage - 2) / taper)
}

let stageBaseCache: number[] = []
let stageBaseKey = ''

/** HP of wall 1 of `stage`: base × the product of every growth step up to it. */
export function stageBaseHp(stage: number): number {
  const key = `${WALL_HP.base}|${WALL_HP.earlyGrowth}|${WALL_HP.lateGrowth}|${WALL_HP.taper}`
  if (key !== stageBaseKey) {
    stageBaseKey = key
    stageBaseCache = [WALL_HP.base]
    for (let s = 2; s <= STAGE_COUNT; s += 1) stageBaseCache.push(stageBaseCache[s - 2] * stageGrowth(s))
  }
  return stageBaseCache[Math.min(Math.max(stage, 1), STAGE_COUNT) - 1]
}

export function wallHp(stage: number, wall: number): number {
  return Math.round(stageBaseHp(stage) * (1 + WALL_HP.perWall * (wall - 1)))
}

export function stageTotalHp(stage: number): number {
  let total = 0
  for (let w = 1; w <= WALLS_PER_STAGE; w += 1) total += wallHp(stage, w)
  return total
}

export function padWins(stage: number): number {
  return PAD_WINS[Math.min(Math.max(stage, 1), STAGE_COUNT) - 1]
}

export function wallBreakWins(stage: number): number {
  return Math.floor(padWins(stage) * WALL_BREAK_WIN_FRACTION)
}

/** Player level needed for the next rebirth, after `rebirths` so far. */
export function rebirthLevel(rebirths: number): number {
  return (rebirths + 1) * REBIRTH.levelStep
}

export function rebirthMultiplier(rebirths: number): number {
  return 1 + rebirths
}

export interface ClickGainFactors {
  boomerangPower: number
  /** 1 when not standing on a training pad. */
  trainingPadMult: number
  rebirths: number
  trailMult: number
  /** Pets are additive: 0.5 means +50%. */
  petBonusSum: number
  /** Potions, permanent 2x, friend boost, event boosts — already multiplied together. */
  boostMult: number
}

/** Power gained by one throw. */
export function clickGain(f: ClickGainFactors): number {
  return (
    f.boomerangPower *
    f.trainingPadMult *
    rebirthMultiplier(f.rebirths) *
    f.trailMult *
    (1 + f.petBonusSum) *
    f.boostMult
  )
}

/* ---------------------------------------------------------------------------
 * Player level: XP is lifetime Power earned, so it never resets.
 * ------------------------------------------------------------------------- */

export const LEVEL = {
  /** XP to reach level 2. Tuned by tools/tune.ts (rebirths are level-gated). */
  base: 19,
  /**
   * XP growth per level tapers from `earlyGrowth` towards `lateGrowth` over
   * `taper` levels: early levels pace the first rebirth (level 15), the gentler
   * tail keeps later rebirths (level 30, 45, …) reachable. Tuned by tools/tune.ts.
   */
  earlyGrowth: 2.211,
  lateGrowth: 1.049,
  taper: 18.2,
}

/** Walking gets faster with level: +1% per level above 1, capped. */
export const LEVEL_SPEED = { perLevel: 0.01, max: 0.6 }

export function levelSpeedMult(level: number): number {
  return 1 + Math.min(LEVEL_SPEED.max, Math.max(0, level - 1) * LEVEL_SPEED.perLevel)
}

const LEVEL_CAP = 2000
let xpTable: number[] = []
let xpTableKey = ''

/** Cumulative XP per level (index = level), rebuilt when the tuner changes LEVEL. */
function levelTable(): number[] {
  const key = `${LEVEL.base}|${LEVEL.earlyGrowth}|${LEVEL.lateGrowth}|${LEVEL.taper}`
  if (key !== xpTableKey) {
    xpTableKey = key
    xpTable = [0, 0, LEVEL.base]
    for (let level = 3; level <= LEVEL_CAP; level += 1) {
      const g = LEVEL.lateGrowth + (LEVEL.earlyGrowth - LEVEL.lateGrowth) * Math.exp(-(level - 3) / LEVEL.taper)
      xpTable.push(xpTable[level - 1] * g)
    }
  }
  return xpTable
}

/** Total XP required to *be* at `level` (level 1 needs 0). */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  return Math.round(levelTable()[Math.min(level, LEVEL_CAP)])
}

export function levelForXp(xp: number): number {
  const t = levelTable()
  let lo = 1
  let hi = LEVEL_CAP
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (t[mid] <= xp) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** 0..1 progress from the current level to the next. */
export function levelProgress(xp: number): number {
  const level = levelForXp(xp)
  const from = xpForLevel(level)
  const to = xpForLevel(level + 1)
  return to > from ? Math.min(1, Math.max(0, (xp - from) / (to - from))) : 1
}
