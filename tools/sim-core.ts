/**
 * Simulation core shared by simulate.ts (report) and tune.ts (parameter search).
 *
 * The economy is the real one: power gain, wall hits, pad claims, purchases and
 * rebirths all go through @game/shared's action functions. Only *time* is modelled
 * here — per wall, the clicks needed are solved in closed form instead of ticking
 * one click at a time, which keeps a 30-hour run to a few milliseconds.
 */

import {
  BOOMERANGS,
  bestOwnedPad,
  buyNextBoomerang,
  buyTrainingPad,
  buyTrail,
  claimPad,
  clickGainFor,
  createPlayerData,
  createRun,
  FIRST_WALL_OFFSET,
  hitWall,
  MAX_SPEED,
  PAD_OFFSET,
  padWins,
  buyPerk,
  levelForXp,
  PERK_SHOP,
  rebirth,
  rebirthLevel,
  STAGE_COUNT,
  THROW,
  TRAILS,
  TRAINING_PADS,
  WALL_SPACING,
  WALL_THICKNESS,
  wallBreakWins,
  wallHp,
  WALLS_PER_STAGE,
  type PlayerData,
} from '@game/shared'

const SIM_PERKS = ['power2x', 'wins2x'] as const

export interface SimOptions {
  cps: number
  maxHours: number
}

export interface SimResult {
  /** Seconds at which each stage was first cleared (index 0 = stage 1). */
  stageReached: number[]
  rebirths: { r: number; t: number; stage: number }[]
  /** When each training pad was bought. */
  padsBought: { pad: number; t: number }[]
  endTime: number
  player: PlayerData
}

/** Seconds lost to a teleport (stages menu / quick-train). */
const TELEPORT_S = 2
/** "Farm Again" respawn delay. */
const RESPAWN_S = 2
/** The simulated player sprints most of the time. */
const SPEED = MAX_SPEED * 0.9
/** Runs that would take longer than this are not attempted. */
const MAX_RUN_S = 2 * 3600

/** Smallest n >= 1 with n·p + g·n(n+1)/2 >= hp: clicks to break a wall. */
export function clicksToBreak(hp: number, p: number, g: number): number {
  if (p >= hp) return 1
  const b = p + g / 2
  // Numerically stable root of (g/2)n² + b·n − hp = 0.
  const n = (2 * hp) / (b + Math.sqrt(b * b + 2 * g * hp))
  return Math.max(1, Math.ceil(n - 1e-9))
}

interface RunTiming {
  time: number
  clicks: number[]
}

/** Time to clear `stage` from its entrance starting at power p, gaining g per throw. */
export function runTiming(stage: number, p: number, g: number, cps: number): RunTiming {
  const dt = 1 / cps
  let t = 0
  let pos = 0
  const clicks: number[] = []
  for (let k = 1; k <= WALLS_PER_STAGE; k += 1) {
    const wz = FIRST_WALL_OFFSET + (k - 1) * WALL_SPACING
    const inRange = wz - THROW.range
    if (pos < inRange) {
      t += (inRange - pos) / SPEED
      pos = inRange
    }
    const n = clicksToBreak(wallHp(stage, k), p, g)
    clicks.push(n)
    p += n * g
    t += n * dt
    pos = Math.min(wz - WALL_THICKNESS / 2 - 0.5, pos + SPEED * n * dt)
    if (t > MAX_RUN_S) return { time: Infinity, clicks }
  }
  t += Math.max(0, PAD_OFFSET - pos) / SPEED
  return { time: t, clicks }
}

export function runSimulation(opts: SimOptions): SimResult {
  const { cps } = opts
  const d = createPlayerData('sim-player-0000000000', 'Sim', 0)
  const ctxNoPad = { padId: -1, friendsInRoom: 0, now: 0 }
  let time = 0
  const stageReached: number[] = []
  const rebirths: SimResult['rebirths'] = []
  const padsBought: SimResult['padsBought'] = []

  const gainNoPad = () => clickGainFor(d, ctxNoPad)
  const gainPad = () => clickGainFor(d, { padId: bestOwnedPad(d.trainingPads), friendsInRoom: 0, now: 0 })
  const nextTrail = () => TRAILS.find((x) => !d.trailsOwned.includes(x.id))

  /** Permanent perks the simulated player saves for once nothing cheaper is left (Auto Win doesn't change click speed). */
  const nextPerk = () => SIM_PERKS.find((id) => !d.perks[id])

  function nextPurchaseCost(): number {
    const perk = nextPerk()
    return Math.min(
      BOOMERANGS[d.boomerangsOwned]?.cost ?? Infinity,
      TRAINING_PADS[d.trainingPads]?.cost ?? Infinity,
      nextTrail()?.cost ?? Infinity,
      perk ? PERK_SHOP[perk].cost : Infinity,
    )
  }

  function shop(): void {
    let bought = true
    while (bought) {
      bought = false
      if (buyTrainingPad(d).ok) {
        bought = true
        padsBought.push({ pad: d.trainingPads - 1, t: time })
      }
      if (buyNextBoomerang(d).ok) bought = true
      const t = nextTrail()
      if (t && buyTrail(d, t.id).ok) bought = true
      const perk = nextPerk()
      if (perk && buyPerk(d, perk, 0).ok) bought = true
    }
    // Rebirths cost no Wins, only a level: take one as soon as it's allowed
    // (everything affordable has just been bought).
    if (levelForXp(d.stats.powerEarned) >= rebirthLevel(d.rebirths)) {
      const stage = d.stageCleared
      rebirth(d)
      rebirths.push({ r: d.rebirths, t: time, stage })
    }
  }

  function train(seconds: number): void {
    time += TELEPORT_S
    const clicks = Math.round(seconds * cps)
    const gp = gainPad()
    d.power += gp * clicks
    d.stats.powerEarned += gp * clicks
    d.stats.throws += clicks
    time += clicks / cps
  }

  /** Plays one run of `stage` using the real wall/pad actions. */
  function playRun(stage: number): boolean {
    const g = gainNoPad()
    const timing = runTiming(stage, d.power, g, cps)
    if (!Number.isFinite(timing.time)) return false
    const run = createRun(stage)
    for (const n of timing.clicks) {
      // n throws: power rises by g each, and each deals the power it had then.
      const damage = n * d.power + (g * n * (n + 1)) / 2
      d.power += n * g
      d.stats.powerEarned += n * g
      d.stats.throws += n
      hitWall(d, run, damage, 0)
    }
    claimPad(d, run, 0)
    time += timing.time
    for (let s = stageReached.length + 1; s <= d.bestStageEver; s += 1) stageReached[s - 1] = time
    time += RESPAWN_S
    return true
  }

  /** Best (train seconds, total seconds) to clear `stage`, training first on the best pad. */
  function bestTrainPlan(stage: number): { train: number; total: number } {
    const g = gainNoPad()
    const gp = gainPad()
    let best = { train: 0, total: runTiming(stage, d.power, g, cps).time }
    for (let train = 4; train <= 48 * 3600; train *= 1.2) {
      const total = train + TELEPORT_S * 2 + runTiming(stage, d.power + train * cps * gp, g, cps).time
      if (total < best.total) best = { train, total }
      if (train > best.total) break
    }
    return best
  }

  function farmRate(stage: number): number {
    const loop = runTiming(stage, d.power, gainNoPad(), cps).time + RESPAWN_S
    if (!Number.isFinite(loop)) return 0
    return (padWins(stage) + wallBreakWins(stage) * WALLS_PER_STAGE) / loop
  }

  while (time < opts.maxHours * 3600 && d.bestStageEver < STAGE_COUNT) {
    shop()
    const target = Math.min(STAGE_COUNT, d.stageCleared + 1)
    const plan = bestTrainPlan(target)

    let farm = { stage: 0, rate: 0 }
    for (let s = d.stageCleared; s >= Math.max(1, d.stageCleared - 3); s -= 1) {
      const rate = farmRate(s)
      if (rate > farm.rate) farm = { stage: s, rate }
    }
    const need = Math.max(0, nextPurchaseCost() - d.wins)
    const tPurchase = farm.rate > 0 ? need / farm.rate : Infinity

    if (plan.total <= tPurchase || farm.stage === 0) {
      if (plan.train > 0) {
        // Train in chunks so purchases and the plan get re-evaluated.
        train(Math.min(plan.train, 300))
        continue
      }
      if (!playRun(target)) train(300)
    } else {
      // Farm until the purchase is affordable (re-evaluated every few minutes).
      const loops = Math.max(1, Math.min(Math.ceil(need / (padWins(farm.stage) || 1)), 20))
      time += TELEPORT_S
      for (let i = 0; i < loops; i += 1) playRun(farm.stage)
    }
  }

  return { stageReached, rebirths, padsBought, endTime: time, player: d }
}
