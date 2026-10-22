/**
 * Values derived from PlayerData. Pure functions — the server uses them to
 * apply actions, the client to preview them, the simulator to model a player.
 */

import { BOOMERANGS, VIP_BOOMERANG } from '../config/boomerangs'
import {
  clickGain,
  levelForXp,
  levelProgress,
  padWins,
  rebirthLevel,
  STAGE_COUNT,
} from '../config/economy'
import { TRAINING_PADS, isPadUnlocked } from '../config/pads'
import { EGGS, type EggDef, petBonus, petSlots } from '../config/pets'
import { BOOSTS, type BoostId, FRIEND_BOOST, GEM_SHOP, STARTER_PACK_WINDOW_MINUTES } from '../config/retention'
import { TRAILS } from '../config/trails'
import type { PetInstance, PlayerData } from '../types'

export function bestBoomerangId(d: PlayerData): number {
  return Math.min(d.boomerangsOwned, BOOMERANGS.length) - 1
}

/** Effective +Power/click of the equipped boomerang (the VIP one if owned). */
export function boomerangPower(d: PlayerData): number {
  const base = BOOMERANGS[bestBoomerangId(d)].power
  return d.vipBoomerang ? base * VIP_BOOMERANG.multiplier : base
}

export function nextBoomerang(d: PlayerData) {
  return BOOMERANGS[d.boomerangsOwned] ?? null
}

export function trailMult(d: PlayerData): number {
  return TRAILS[d.equippedTrail]?.mult ?? 1
}

export function equippedPetInstances(d: PlayerData): PetInstance[] {
  const byUid = new Map(d.pets.map((p) => [p.uid, p]))
  const out: PetInstance[] = []
  for (const uid of d.equippedPets) {
    const p = byUid.get(uid)
    if (p) out.push(p)
  }
  return out
}

export function petBonusSum(d: PlayerData): number {
  let sum = 0
  for (const p of equippedPetInstances(d)) sum += petBonus(p.rarity, p.golden)
  return sum
}

export function maxPetSlots(d: PlayerData): number {
  return petSlots(d.rebirths)
}

export function boostActive(d: PlayerData, id: BoostId, now: number): boolean {
  return (d.boosts[id] ?? 0) > now
}

export function boostRemainingSeconds(d: PlayerData, id: BoostId, now: number): number {
  return Math.max(0, ((d.boosts[id] ?? 0) - now) / 1000)
}

export function friendBoostFraction(friendsInRoom: number): number {
  return Math.min(FRIEND_BOOST.max, Math.max(0, friendsInRoom) * FRIEND_BOOST.perFriend)
}

export interface GainContext {
  /** Training pad id the player stands on, or -1. Locked pads count as -1. */
  padId: number
  /** Friends of this player currently in the same room. */
  friendsInRoom: number
  now: number
}

/** Product of every boost that applies to click gain. */
export function boostMultiplier(d: PlayerData, ctx: GainContext): number {
  let mult = 1
  if (boostActive(d, 'click3x', ctx.now)) mult *= BOOSTS.click3x.mult
  if (boostActive(d, 'power2x', ctx.now)) mult *= BOOSTS.power2x.mult
  if (d.perks.power2x) mult *= 2
  if (ctx.padId >= 0 && boostActive(d, 'training2x', ctx.now)) mult *= BOOSTS.training2x.mult
  mult *= 1 + friendBoostFraction(ctx.friendsInRoom)
  return mult
}

export function trainingPadMult(d: PlayerData, padId: number): number {
  if (padId < 0 || !isPadUnlocked(padId, d.rebirths)) return 1
  return TRAINING_PADS[padId].mult
}

/** Power one throw adds right now. */
export function clickGainFor(d: PlayerData, ctx: GainContext): number {
  return clickGain({
    boomerangPower: boomerangPower(d),
    trainingPadMult: trainingPadMult(d, ctx.padId),
    rebirths: d.rebirths,
    trailMult: trailMult(d),
    petBonusSum: petBonusSum(d),
    boostMult: boostMultiplier(d, ctx),
  })
}

export function winsMultiplier(d: PlayerData, now: number): number {
  let mult = 1
  if (boostActive(d, 'wins2x', now)) mult *= BOOSTS.wins2x.mult
  if (d.perks.wins2x) mult *= 2
  return mult
}

export function playerLevel(d: PlayerData): number {
  return levelForXp(d.stats.powerEarned)
}

/** Highest stage the player may enter right now. */
export function highestUnlockedStage(d: PlayerData): number {
  return Math.min(STAGE_COUNT, d.stageCleared + 1)
}

export function isStageUnlocked(d: PlayerData, stage: number): boolean {
  return stage >= 1 && stage <= highestUnlockedStage(d)
}

/** Wins for "worth N clears of your best stage" rewards. */
export function rewardWins(d: PlayerData, winsPads: number): number {
  return Math.max(1, Math.round(padWins(Math.max(1, d.stageCleared)) * winsPads))
}

export function isEggUnlocked(d: PlayerData, egg: EggDef): boolean {
  return d.bestStageEver >= egg.unlockStage
}

/** Best wins-priced egg the player has unlocked (lucky blocks and gift eggs). */
export function bestUnlockedEgg(d: PlayerData): EggDef {
  let best = EGGS[0]
  for (const egg of EGGS) {
    if (egg.currency === 'wins' && isEggUnlocked(d, egg)) best = egg
  }
  return best
}

/** 0..1 towards the next rebirth's level (fractional levels, from level 1). */
export function rebirthProgressForXp(xp: number, rebirths: number): number {
  const level = levelForXp(xp) + levelProgress(xp)
  return Math.min(1, Math.max(0, (level - 1) / (rebirthLevel(rebirths) - 1)))
}

export function rebirthProgress(d: PlayerData): number {
  return rebirthProgressForXp(d.stats.powerEarned, d.rebirths)
}

export function autoThrowUnlocked(d: PlayerData): boolean {
  return d.rebirths >= 1
}

/** Seconds left on the Starter Pack offer, or 0 when gone. */
export function starterPackSecondsLeft(d: PlayerData, now: number): number {
  if (d.perks.starterPack) return 0
  const end = d.createdAt + STARTER_PACK_WINDOW_MINUTES * 60_000
  return Math.max(0, (end - now) / 1000)
}

export function gemItemCost(id: keyof typeof GEM_SHOP): number {
  return GEM_SHOP[id].cost
}
