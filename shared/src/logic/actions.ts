/**
 * Every mutation of PlayerData. The server is the only caller that persists the
 * results; the simulator calls the same functions so balance numbers are exact.
 *
 * Functions validate their own preconditions and return a Result, so a caller
 * never applies half an action.
 */

import { BOOMERANGS } from '../config/boomerangs'
import { TRAINING_PADS } from '../config/pads'
import {
  padWins,
  levelForXp,
  rebirthLevel,
  STAGE_COUNT,
  wallBreakWins,
  wallHp,
  WALLS_PER_STAGE,
} from '../config/economy'
import {
  EGG_BY_ID,
  type EggId,
  PET_BY_ID,
  PETS_CONFIG,
  type Rarity,
  RARITIES,
  petBonus,
  petsOfEgg,
  rarityIndex,
} from '../config/pets'
import {
  type BadgeId,
  BOOST_MAX_MINUTES,
  type BoostId,
  CODES,
  DAILY_QUESTS,
  DAILY_REWARDS,
  PERK_SHOP,
  type PerkId,
  HALLOWEEN,
  OFFLINE,
  PLAYTIME_GIFTS,
  type QuestDef,
  type QuestStat,
  QUESTS_PER_PERIOD,
  type RewardDef,
  TUTORIAL,
  TUTORIAL_REWARDS,
  WEEKLY_QUESTS,
} from '../config/retention'
import { TRAILS } from '../config/trails'
import { fail, type Result } from '../errors'
import type { PetInstance, PlayerData, QuestBook } from '../types'
import { utcDay, utcWeek } from '../types'
import {
  clickGainFor,
  type GainContext,
  isEggUnlocked,
  maxPetSlots,
  rewardWins,
  starterPackSecondsLeft,
  winsMultiplier,
} from './derived'
import { hashString, mulberry32, pickDistinct, type Rng, weightedIndex } from './rng'

/* ---------------------------------------------------------------------------
 * Currency
 * ------------------------------------------------------------------------- */

/** Wins earned by playing: counts towards the leaderboard and offline average. */
export function addWins(d: PlayerData, amount: number): void {
  if (amount <= 0) return
  d.wins += amount
  d.totalWins += amount
  d.stats.winsEarned += amount
}

/* ---------------------------------------------------------------------------
 * Throwing and stages
 * ------------------------------------------------------------------------- */

/** Adds one throw's Power gain and returns it. */
export function applyThrowGain(d: PlayerData, ctx: GainContext): number {
  const gain = clickGainFor(d, ctx)
  d.power += gain
  d.stats.powerEarned += gain
  d.stats.throws += 1
  return gain
}

/** A player's progress through one stage. Lives only in the session, never saved. */
export interface StageRun {
  stage: number
  wallsBroken: number
  /** HP left on the current wall (0 once all walls are down). */
  wallHp: number
  padClaimed: boolean
}

export function createRun(stage: number): StageRun {
  return { stage, wallsBroken: 0, wallHp: wallHp(stage, 1), padClaimed: false }
}

/** Whether a run has anything to reset: a broken wall, a later stage or a claimed pad. */
export function runHasProgress(run: StageRun): boolean {
  return run.stage !== 1 || run.wallsBroken > 0 || run.padClaimed
}

export interface WallHitResult {
  damage: number
  broken: boolean
  winsGained: number
  stageCleared: boolean
  /** Stage newly unlocked by this break (its gate opens), or 0. */
  unlocked: number
}

/** Hits the run's current wall with `damage`. No overflow into the next wall. */
export function hitWall(d: PlayerData, run: StageRun, damage: number, now: number): WallHitResult {
  const result: WallHitResult = { damage: 0, broken: false, winsGained: 0, stageCleared: false, unlocked: 0 }
  if (run.wallsBroken >= WALLS_PER_STAGE || damage <= 0) return result

  result.damage = Math.min(damage, run.wallHp)
  run.wallHp -= damage
  if (run.wallHp > 0) return result

  run.wallsBroken += 1
  d.stats.wallsBroken += 1
  result.broken = true
  result.winsGained = Math.floor(wallBreakWins(run.stage) * winsMultiplier(d, now))
  addWins(d, result.winsGained)

  if (run.wallsBroken < WALLS_PER_STAGE) {
    run.wallHp = wallHp(run.stage, run.wallsBroken + 1)
  } else {
    // All 10 walls down: the stage is cleared and the next one unlocks — its gate
    // opens so the player can walk straight on (the Wins pad is optional).
    run.wallHp = 0
    result.stageCleared = true
    const before = d.stageCleared
    d.stageCleared = Math.max(d.stageCleared, run.stage)
    d.bestStageEver = Math.max(d.bestStageEver, run.stage)
    d.dailyQuests.stageBest = Math.max(d.dailyQuests.stageBest, run.stage)
    d.weeklyQuests.stageBest = Math.max(d.weeklyQuests.stageBest, run.stage)
    result.unlocked = d.stageCleared > before && d.stageCleared < STAGE_COUNT ? d.stageCleared + 1 : 0
  }
  return result
}

/** The Wins pad of the run's stage (its walls must be down). Claiming ends the run. */
export function claimPad(d: PlayerData, run: StageRun, now: number): Result<{ wins: number }> {
  if (run.wallsBroken < WALLS_PER_STAGE) return fail('walls_remaining')
  if (run.padClaimed) return fail('already_claimed')

  const wins = Math.floor(padWins(run.stage) * winsMultiplier(d, now))
  addWins(d, wins)
  run.padClaimed = true
  d.stats.padsClaimed += 1
  return { ok: true, wins }
}

/* ---------------------------------------------------------------------------
 * Shops: boomerangs, trails, rebirth
 * ------------------------------------------------------------------------- */

export function buyNextBoomerang(d: PlayerData): Result<{ id: number }> {
  const next = BOOMERANGS[d.boomerangsOwned]
  if (!next) return fail('all_owned')
  if (d.wins < next.cost) return fail('not_enough_wins')
  d.wins -= next.cost
  d.boomerangsOwned += 1
  return { ok: true, id: next.id }
}

/** Buys the next training pad (they are bought in order). */
export function buyTrainingPad(d: PlayerData): Result<{ id: number }> {
  const next = TRAINING_PADS[d.trainingPads]
  if (!next) return fail('all_owned')
  if (d.wins < next.cost) return fail('not_enough_wins')
  d.wins -= next.cost
  d.trainingPads += 1
  return { ok: true, id: next.id }
}

export function buyTrail(d: PlayerData, id: number): Result<{ id: number }> {
  const trail = TRAILS[id]
  if (!trail) return fail('not_found')
  if (d.trailsOwned.includes(id)) return fail('already_owned')
  if (d.wins < trail.cost) return fail('not_enough_wins')
  d.wins -= trail.cost
  d.trailsOwned.push(id)
  d.trailsOwned.sort((a, b) => a - b)
  // A newly bought trail is always at least as good as anything cheaper; wear it.
  if (trail.mult >= (TRAILS[d.equippedTrail]?.mult ?? 1)) d.equippedTrail = id
  return { ok: true, id }
}

export function equipTrail(d: PlayerData, id: number): Result {
  if (!TRAILS[id]) return fail('not_found')
  if (!d.trailsOwned.includes(id)) return fail('not_owned')
  d.equippedTrail = id
  return { ok: true }
}

export function rebirth(d: PlayerData): Result<{ rebirths: number }> {
  if (levelForXp(d.stats.powerEarned) < rebirthLevel(d.rebirths)) return fail('level_too_low')
  d.rebirths += 1
  d.stats.rebirths += 1
  // Resets: Power, Wins, stage progress. Everything else is kept.
  d.power = 0
  d.wins = 0
  d.stageCleared = 0
  return { ok: true, rebirths: d.rebirths }
}

/* ---------------------------------------------------------------------------
 * Boosts and rewards
 * ------------------------------------------------------------------------- */

export function addBoost(d: PlayerData, id: BoostId, minutes: number, now: number): void {
  const current = Math.max(now, d.boosts[id] ?? 0)
  d.boosts[id] = Math.min(current + minutes * 60_000, now + BOOST_MAX_MINUTES * 60_000)
}

export interface RewardSummary {
  wins: number
  pumpkins: number
  boosts: { id: BoostId; minutes: number }[]
  /** The VIP boomerang dropped (lucky block). */
  vip: boolean
}

const emptySummary = (): RewardSummary => ({
  wins: 0,
  pumpkins: 0,
  boosts: [],
  vip: false,
})

export function grantReward(d: PlayerData, reward: RewardDef, now: number): RewardSummary {
  const s = emptySummary()
  if (reward.winsPads) {
    s.wins = rewardWins(d, reward.winsPads)
    addWins(d, s.wins)
  }
  if (reward.pumpkins) {
    s.pumpkins = reward.pumpkins
    d.pumpkins += reward.pumpkins
  }
  for (const b of reward.boosts ?? []) {
    addBoost(d, b.id, b.minutes, now)
    s.boosts.push({ id: b.id, minutes: b.minutes })
  }
  return s
}

/** Lucky Block: a chance at the VIP boomerang, otherwise Wins and a short boost. */
export const LUCKY_REWARD = { vipChance: 3, winsPads: 6, boostMinutes: 10 } as const

export function grantLuckyReward(d: PlayerData, rng: Rng, now: number): RewardSummary {
  if (!d.vipBoomerang && rng() * 100 < LUCKY_REWARD.vipChance) {
    d.vipBoomerang = true
    return { ...emptySummary(), vip: true }
  }
  const boosts: BoostId[] = ['click3x', 'power2x', 'wins2x', 'training2x']
  const boost = boosts[Math.floor(rng() * boosts.length)]
  return grantReward(d, { winsPads: LUCKY_REWARD.winsPads, boosts: [{ id: boost, minutes: LUCKY_REWARD.boostMinutes }] }, now)
}

/* ---------------------------------------------------------------------------
 * Pets and eggs
 * ------------------------------------------------------------------------- */

function addPet(d: PlayerData, petId: string, rarity: Rarity, golden: boolean): PetInstance {
  const pet: PetInstance = { uid: `p${d.nextPetUid}`, petId, rarity, golden }
  d.nextPetUid += 1
  d.pets.push(pet)
  // Fill a free equip slot straight away so new players feel the bonus.
  if (d.equippedPets.length < maxPetSlots(d)) d.equippedPets.push(pet.uid)
  return pet
}

function rollRarity(odds: readonly number[], pity: number, rng: Rng): Rarity {
  const epic = rarityIndex('epic')
  if (pity + 1 >= PETS_CONFIG.pityOpens) {
    const forced = odds.map((w, i) => (i >= epic ? w : 0))
    if (forced.some((w) => w > 0)) return RARITIES[weightedIndex(forced, rng)]
  }
  return RARITIES[weightedIndex(odds, rng)]
}

export function openEgg(
  d: PlayerData,
  eggId: EggId,
  count: number,
  rng: Rng,
  opts: { free?: boolean } = {},
): Result<{ pets: PetInstance[]; vip: boolean }> {
  const egg = EGG_BY_ID[eggId]
  if (!egg) return fail('not_found')
  if (count !== 1 && count !== 3) return fail('bad_request')
  if (count === 3 && d.rebirths < PETS_CONFIG.tripleOpenRebirths) return fail('triple_locked')
  if (!isEggUnlocked(d, egg)) return fail('egg_locked')
  if (d.pets.length + count > PETS_CONFIG.inventoryMax) return fail('inventory_full')

  if (!opts.free) {
    const cost = egg.cost * count
    if (egg.currency === 'wins') {
      if (d.wins < cost) return fail('not_enough_wins')
      d.wins -= cost
    } else {
      if (d.pumpkins < cost) return fail('not_enough_pumpkins')
      d.pumpkins -= cost
    }
  }

  const species = petsOfEgg(eggId)
  const pets: PetInstance[] = []
  let vip = false
  for (let i = 0; i < count; i += 1) {
    if (egg.vipChance && !d.vipBoomerang && rng() * 100 < egg.vipChance) {
      d.vipBoomerang = true
      vip = true
      continue
    }
    const pity = d.eggPity[eggId] ?? 0
    const rarity = rollRarity(egg.odds, pity, rng)
    d.eggPity[eggId] = rarityIndex(rarity) >= rarityIndex('epic') ? 0 : pity + 1
    const def = species[Math.floor(rng() * species.length)]
    pets.push(addPet(d, def.id, rarity, false))
  }
  d.stats.eggsOpened += count
  return { ok: true, pets, vip }
}

export function equipPet(d: PlayerData, uid: string): Result {
  if (!d.pets.some((p) => p.uid === uid)) return fail('not_found')
  if (d.equippedPets.includes(uid)) return { ok: true }
  if (d.equippedPets.length >= maxPetSlots(d)) return fail('no_slots')
  d.equippedPets.push(uid)
  return { ok: true }
}

export function unequipPet(d: PlayerData, uid: string): Result {
  d.equippedPets = d.equippedPets.filter((u) => u !== uid)
  return { ok: true }
}

export function equipBestPets(d: PlayerData): Result {
  const sorted = d.pets
    .slice()
    .sort((a, b) => petBonus(b.rarity, b.golden) - petBonus(a.rarity, a.golden))
  d.equippedPets = sorted.slice(0, maxPetSlots(d)).map((p) => p.uid)
  return { ok: true }
}

export function deletePet(d: PlayerData, uid: string): Result {
  const before = d.pets.length
  d.pets = d.pets.filter((p) => p.uid !== uid)
  if (d.pets.length === before) return fail('not_found')
  d.equippedPets = d.equippedPets.filter((u) => u !== uid)
  return { ok: true }
}

/** Five identical (same species, rarity, non-golden) pets → one golden. */
export function mergePets(d: PlayerData, petId: string, rarity: Rarity): Result<{ pet: PetInstance }> {
  if (!PET_BY_ID[petId]) return fail('not_found')
  const matches = d.pets.filter((p) => p.petId === petId && p.rarity === rarity && !p.golden)
  if (matches.length < PETS_CONFIG.goldenMergeCount) return fail('not_enough_pets')

  // Prefer consuming unequipped copies.
  matches.sort((a, b) => Number(d.equippedPets.includes(a.uid)) - Number(d.equippedPets.includes(b.uid)))
  const consumed = new Set(matches.slice(0, PETS_CONFIG.goldenMergeCount).map((p) => p.uid))
  const wasEquipped = d.equippedPets.some((u) => consumed.has(u))
  d.pets = d.pets.filter((p) => !consumed.has(p.uid))
  d.equippedPets = d.equippedPets.filter((u) => !consumed.has(u))

  const pet: PetInstance = { uid: `p${d.nextPetUid}`, petId, rarity, golden: true }
  d.nextPetUid += 1
  d.pets.push(pet)
  if (wasEquipped || d.equippedPets.length < maxPetSlots(d)) d.equippedPets.push(pet.uid)
  return { ok: true, pet }
}

/* ---------------------------------------------------------------------------
 * Daily / weekly periods, gifts, quests
 * ------------------------------------------------------------------------- */

function statValue(d: PlayerData, stat: QuestStat): number {
  switch (stat) {
    case 'throws':
      return d.stats.throws
    case 'wallsBroken':
      return d.stats.wallsBroken
    case 'eggsOpened':
      return d.stats.eggsOpened
    case 'pumpkins':
      return d.stats.pumpkins
    case 'padsClaimed':
      return d.stats.padsClaimed
    case 'rebirths':
      return d.stats.rebirths
    case 'playMinutes':
      return Math.floor(d.stats.playSeconds / 60)
    case 'stageClear':
      return 0
  }
}

function assignQuests(d: PlayerData, pool: readonly QuestDef[], period: number, salt: string): QuestBook {
  const rng = mulberry32(hashString(`${d.id}:${salt}:${period}`))
  const picked = pickDistinct(pool, QUESTS_PER_PERIOD, rng)
  return {
    period,
    stageBest: 0,
    quests: picked.map((q) => ({ id: q.id, base: statValue(d, q.stat), claimed: false })),
  }
}

/** Rolls over the playtime day, daily quests and weekly quests when due. */
export function refreshPeriods(d: PlayerData, now: number): boolean {
  let changed = false
  const day = utcDay(now)
  const week = utcWeek(now)
  if (d.playtime.day !== day) {
    d.playtime = { day, seconds: 0, claimed: [] }
    changed = true
  }
  if (d.dailyQuests.period !== day) {
    d.dailyQuests = assignQuests(d, DAILY_QUESTS, day, 'daily')
    changed = true
  }
  if (d.weeklyQuests.period !== week) {
    d.weeklyQuests = assignQuests(d, WEEKLY_QUESTS, week, 'weekly')
    changed = true
  }
  for (const id of Object.keys(d.boosts) as BoostId[]) {
    if ((d.boosts[id] ?? 0) <= now) {
      delete d.boosts[id]
      changed = true
    }
  }
  return changed
}

export function questDef(id: string): QuestDef | undefined {
  return DAILY_QUESTS.find((q) => q.id === id) ?? WEEKLY_QUESTS.find((q) => q.id === id)
}

export function questProgress(d: PlayerData, book: QuestBook, id: string): { value: number; target: number } {
  const def = questDef(id)
  const entry = book.quests.find((q) => q.id === id)
  if (!def || !entry) return { value: 0, target: 1 }
  if (def.stat === 'stageClear') {
    return { value: book.stageBest >= def.target ? def.target : book.stageBest, target: def.target }
  }
  return { value: Math.min(def.target, Math.max(0, statValue(d, def.stat) - entry.base)), target: def.target }
}

export function claimQuest(d: PlayerData, id: string, now: number): Result<{ reward: RewardSummary }> {
  refreshPeriods(d, now)
  const book = d.dailyQuests.quests.some((q) => q.id === id) ? d.dailyQuests : d.weeklyQuests
  const entry = book.quests.find((q) => q.id === id)
  const def = questDef(id)
  if (!entry || !def) return fail('not_found')
  if (entry.claimed) return fail('already_claimed')
  const { value, target } = questProgress(d, book, id)
  if (value < target) return fail('not_ready')
  entry.claimed = true
  return { ok: true, reward: grantReward(d, def.reward, now) }
}

export function claimGift(d: PlayerData, index: number, now: number): Result<{ reward: RewardSummary }> {
  refreshPeriods(d, now)
  const gift = PLAYTIME_GIFTS[index]
  if (!gift) return fail('not_found')
  if (d.playtime.claimed.includes(index)) return fail('already_claimed')
  if (d.playtime.seconds < gift.minutes * 60) return fail('not_ready')
  d.playtime.claimed.push(index)
  return { ok: true, reward: grantReward(d, gift.reward, now) }
}

/** The calendar day (1..7) the next claim would pay out. */
export function dailyNextDay(d: PlayerData, now: number): number {
  const today = utcDay(now)
  if (d.daily.lastClaimDay === today) return (d.daily.streak % 7) + 1
  if (d.daily.lastClaimDay === today - 1) return (d.daily.streak % 7) + 1
  return 1
}

export function dailyCanClaim(d: PlayerData, now: number): boolean {
  return d.daily.lastClaimDay !== utcDay(now)
}

export function claimDaily(d: PlayerData, now: number): Result<{ day: number; reward: RewardSummary }> {
  if (!dailyCanClaim(d, now)) return fail('already_claimed')
  const day = dailyNextDay(d, now)
  d.daily.streak = day
  d.daily.lastClaimDay = utcDay(now)
  return { ok: true, day, reward: grantReward(d, DAILY_REWARDS[day - 1], now) }
}

/** Adds active play time (called by the server once a second per connected player). */
export function addPlaytime(d: PlayerData, seconds: number, now: number): void {
  refreshPeriods(d, now)
  d.playtime.seconds += seconds
  d.stats.playSeconds += seconds
}

/* ---------------------------------------------------------------------------
 * Perk shop, codes, friends, pumpkins
 * ------------------------------------------------------------------------- */

export function buyPerk(d: PlayerData, id: PerkId, now: number): Result<{ reward: RewardSummary | null }> {
  const item = PERK_SHOP[id]
  if (!item) return fail('not_found')
  if (id === 'starterPack') {
    if (d.perks.starterPack) return fail('already_owned')
    if (starterPackSecondsLeft(d, now) <= 0) return fail('offer_expired')
  } else if (d.perks[id]) {
    return fail('already_owned')
  }
  if (d.wins < item.cost) return fail('not_enough_wins')
  d.wins -= item.cost
  d.perks[id] = true
  return { ok: true, reward: item.reward ? grantReward(d, item.reward, now) : null }
}

export function redeemCode(d: PlayerData, rawCode: string, now: number): Result<{ code: string; reward: RewardSummary }> {
  const code = String(rawCode ?? '').trim().toUpperCase()
  const reward = CODES[code]
  if (!reward) return fail('invalid_code')
  if (d.codes.includes(code)) return fail('code_used')
  d.codes.push(code)
  return { ok: true, code, reward: grantReward(d, reward, now) }
}

export const MAX_FRIENDS = 50

export function addFriend(d: PlayerData, otherId: string): Result {
  if (!otherId || otherId === d.id) return fail('bad_request')
  if (!d.friends.includes(otherId)) {
    if (d.friends.length >= MAX_FRIENDS) d.friends.shift()
    d.friends.push(otherId)
  }
  return { ok: true }
}

export function removeFriend(d: PlayerData, otherId: string): Result {
  d.friends = d.friends.filter((f) => f !== otherId)
  return { ok: true }
}

export function pumpkinAvailable(d: PlayerData, index: number, now: number): boolean {
  return (d.pumpkinRespawn[index] ?? 0) <= now
}

export function collectPumpkin(d: PlayerData, index: number, now: number): Result<{ amount: number }> {
  if (!HALLOWEEN.enabled) return fail('not_found')
  if (!pumpkinAvailable(d, index, now)) return fail('not_ready')
  d.pumpkins += HALLOWEEN.pumpkinValue
  d.stats.pumpkins += 1
  d.pumpkinRespawn[index] = now + HALLOWEEN.pumpkinRespawnSeconds * 1000
  return { ok: true, amount: HALLOWEEN.pumpkinValue }
}

/* ---------------------------------------------------------------------------
 * Tutorial and badges
 * ------------------------------------------------------------------------- */

export const TUTORIAL_STEPS = {
  train: 0,
  breakWalls: 1,
  collectWins: 2,
  buyTrail: 3,
  reward: 4,
  done: 5,
} as const

/**
 * Advances the tutorial when its current goal is met. `run` is the active stage
 * run, used for the wall/pad steps.
 */
export function advanceTutorial(d: PlayerData, run: StageRun | null): boolean {
  const before = d.tutorialStep
  if (d.tutorialStep === TUTORIAL_STEPS.train && d.power >= TUTORIAL.trainPower) {
    d.tutorialStep = TUTORIAL_STEPS.breakWalls
  }
  if (d.tutorialStep === TUTORIAL_STEPS.breakWalls && (d.stageCleared > 0 || (run && run.wallsBroken >= WALLS_PER_STAGE))) {
    d.tutorialStep = TUTORIAL_STEPS.collectWins
  }
  if (d.tutorialStep === TUTORIAL_STEPS.collectWins && d.stats.padsClaimed > 0) {
    d.tutorialStep = TUTORIAL_STEPS.buyTrail
  }
  if (d.tutorialStep === TUTORIAL_STEPS.buyTrail && d.trailsOwned.includes(TUTORIAL.trailId)) {
    d.tutorialStep = TUTORIAL_STEPS.reward
  }
  return d.tutorialStep !== before
}

/** Rolls and grants the tutorial-complete reward. Returns the option index for the roulette. */
export function rollTutorialReward(d: PlayerData, rng: Rng, now: number): Result<{ index: number }> {
  if (d.tutorialStep !== TUTORIAL_STEPS.reward) return fail('not_ready')
  const index = weightedIndex(
    TUTORIAL_REWARDS.map((o) => o.weight),
    rng,
  )
  const option = TUTORIAL_REWARDS[index]
  addBoost(d, option.boost.id, option.boost.minutes, now)
  d.tutorialStep = TUTORIAL_STEPS.done
  return { ok: true, index }
}

/** Awards any newly earned badges and returns them. */
export function checkBadges(d: PlayerData): BadgeId[] {
  const earned: BadgeId[] = []
  const award = (id: BadgeId, cond: boolean) => {
    if (cond && !d.badges.includes(id)) {
      d.badges.push(id)
      earned.push(id)
    }
  }
  award('first_throw', d.stats.throws >= 1)
  award('power_100', d.power >= 100)
  award('stage_5', d.bestStageEver >= 5)
  award('stage_10', d.bestStageEver >= 10)
  award('stage_20', d.bestStageEver >= 20)
  award('stage_30', d.bestStageEver >= 30)
  award('first_rebirth', d.rebirths >= 1)
  award(
    'first_legendary',
    d.pets.some((p) => rarityIndex(p.rarity) >= rarityIndex('legendary')),
  )
  return earned
}

/* ---------------------------------------------------------------------------
 * Offline earnings
 * ------------------------------------------------------------------------- */

/**
 * 10% of the player's average active wins/minute for the time they were away
 * (capped at 8h). Granted on join; returns what was given.
 */
export function grantOfflineEarnings(d: PlayerData, now: number): { minutes: number; wins: number } {
  const awayMinutes = (now - d.lastSeen) / 60_000
  if (awayMinutes < OFFLINE.minAwayMinutes) return { minutes: 0, wins: 0 }
  const minutes = Math.min(awayMinutes, OFFLINE.maxHours * 60)
  const playMinutes = d.stats.playSeconds / 60
  if (playMinutes < 1) return { minutes: 0, wins: 0 }
  const perMinute = d.stats.winsEarned / playMinutes
  const wins = Math.floor(perMinute * minutes * OFFLINE.fraction)
  if (wins <= 0) return { minutes: 0, wins: 0 }
  // Credited to the balance and leaderboard, but not to the active-play average.
  d.wins += wins
  d.totalWins += wins
  return { minutes: Math.floor(minutes), wins }
}
