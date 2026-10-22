/**
 * The persisted player record. The server owns it; the client receives copies.
 */

import { type EggId, PET_BY_ID, type Rarity } from './config/pets'
import type { BadgeId, BoostId } from './config/retention'

export const PLAYER_DATA_VERSION = 1

export interface PetInstance {
  uid: string
  petId: string
  rarity: Rarity
  golden: boolean
}

export interface QuestProgress {
  id: string
  /** Stat value when the quest was assigned; progress = stat - base. */
  base: number
  claimed: boolean
}

export interface QuestBook {
  /** UTC day number (daily) or week number (weekly) this book belongs to. */
  period: number
  quests: QuestProgress[]
  /** Highest stage whose pad was claimed during this period (for "Clear Stage N"). */
  stageBest: number
}

export interface PlayerStats {
  throws: number
  wallsBroken: number
  padsClaimed: number
  eggsOpened: number
  pumpkins: number
  rebirths: number
  playSeconds: number
  /** Wins earned while actually playing (offline earnings excluded). */
  winsEarned: number
  /** Lifetime Power earned = player XP. Never resets. */
  powerEarned: number
}

export interface PlayerPerks {
  power2x: boolean
  wins2x: boolean
  autoWin: boolean
  starterPack: boolean
}

export interface PlayerData {
  v: number
  id: string
  name: string
  createdAt: number
  lastSeen: number

  power: number
  wins: number
  pumpkins: number
  rebirths: number

  /** Highest stage cleared this rebirth (0..30). Stages 1..cleared+1 are unlocked. */
  stageCleared: number
  /** Highest stage cleared ever (leaderboard, egg unlocks). */
  bestStageEver: number

  /** Count of boomerangs owned; they are bought in order, so ids 0..n-1 are owned. */
  boomerangsOwned: number
  vipBoomerang: boolean
  trailsOwned: number[]
  equippedTrail: number

  pets: PetInstance[]
  equippedPets: string[]
  eggPity: Partial<Record<EggId, number>>
  nextPetUid: number

  /** Timed boosts: expiry time in ms. */
  boosts: Partial<Record<BoostId, number>>
  perks: PlayerPerks

  playtime: { day: number; seconds: number; claimed: number[] }
  daily: { streak: number; lastClaimDay: number }
  dailyQuests: QuestBook
  weeklyQuests: QuestBook

  stats: PlayerStats
  /** Lifetime wins (leaderboard "Top Wins"); never reset by rebirth. */
  totalWins: number
  badges: BadgeId[]
  codes: string[]
  /** Player ids this player has added as friends. */
  friends: string[]

  /** 0 train, 1 break walls, 2 collect wins, 3 buy trail, 4 reward roll pending, 5 done. */
  tutorialStep: number
  /** Per pumpkin spawn index: ms time it becomes collectable again. */
  pumpkinRespawn: Record<number, number>
}

export const DAY_MS = 86_400_000

/** Days since the Unix epoch, UTC. */
export function utcDay(now: number): number {
  return Math.floor(now / DAY_MS)
}

/** Weeks since the epoch, starting on Mondays (1970-01-01 was a Thursday). */
export function utcWeek(now: number): number {
  return Math.floor((utcDay(now) + 3) / 7)
}

export function createPlayerData(id: string, name: string, now: number): PlayerData {
  return {
    v: PLAYER_DATA_VERSION,
    id,
    name,
    createdAt: now,
    lastSeen: now,
    power: 0,
    wins: 0,
    pumpkins: 0,
    rebirths: 0,
    stageCleared: 0,
    bestStageEver: 0,
    boomerangsOwned: 1,
    vipBoomerang: false,
    trailsOwned: [0],
    equippedTrail: 0,
    pets: [],
    equippedPets: [],
    eggPity: {},
    nextPetUid: 1,
    boosts: {},
    perks: { power2x: false, wins2x: false, autoWin: false, starterPack: false },
    playtime: { day: utcDay(now), seconds: 0, claimed: [] },
    daily: { streak: 0, lastClaimDay: -1 },
    dailyQuests: { period: -1, quests: [], stageBest: 0 },
    weeklyQuests: { period: -1, quests: [], stageBest: 0 },
    stats: {
      throws: 0,
      wallsBroken: 0,
      padsClaimed: 0,
      eggsOpened: 0,
      pumpkins: 0,
      rebirths: 0,
      playSeconds: 0,
      winsEarned: 0,
      powerEarned: 0,
    },
    totalWins: 0,
    badges: [],
    codes: [],
    friends: [],
    tutorialStep: 0,
    pumpkinRespawn: {},
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

/**
 * Fills in anything missing from a stored record (older versions, partial writes),
 * so the rest of the code can assume a complete PlayerData.
 */
export function normalizePlayerData(raw: unknown, id: string, name: string, now: number): PlayerData {
  const base = createPlayerData(id, name, now)
  if (!isObj(raw)) return base
  const r = raw as Partial<PlayerData>

  const merged: PlayerData = {
    ...base,
    ...r,
    v: PLAYER_DATA_VERSION,
    id,
    name: typeof r.name === 'string' && r.name ? r.name : name,
    power: num(r.power, 0),
    wins: num(r.wins, 0),
    pumpkins: num(r.pumpkins, 0),
    rebirths: num(r.rebirths, 0),
    stageCleared: num(r.stageCleared, 0),
    bestStageEver: num(r.bestStageEver, 0),
    boomerangsOwned: Math.max(1, num(r.boomerangsOwned, 1)),
    trailsOwned: Array.isArray(r.trailsOwned) && r.trailsOwned.length ? r.trailsOwned : [0],
    pets: Array.isArray(r.pets) ? r.pets : [],
    equippedPets: Array.isArray(r.equippedPets) ? r.equippedPets : [],
    eggPity: isObj(r.eggPity) ? r.eggPity : {},
    boosts: isObj(r.boosts) ? r.boosts : {},
    perks: { ...base.perks, ...(isObj(r.perks) ? r.perks : {}) },
    playtime: { ...base.playtime, ...(isObj(r.playtime) ? r.playtime : {}) },
    daily: { ...base.daily, ...(isObj(r.daily) ? r.daily : {}) },
    dailyQuests: isObj(r.dailyQuests) ? (r.dailyQuests as QuestBook) : base.dailyQuests,
    weeklyQuests: isObj(r.weeklyQuests) ? (r.weeklyQuests as QuestBook) : base.weeklyQuests,
    stats: { ...base.stats, ...(isObj(r.stats) ? r.stats : {}) },
    badges: Array.isArray(r.badges) ? r.badges : [],
    codes: Array.isArray(r.codes) ? r.codes : [],
    friends: Array.isArray(r.friends) ? r.friends : [],
    pumpkinRespawn: isObj(r.pumpkinRespawn) ? (r.pumpkinRespawn as Record<number, number>) : {},
  }
  // Gems were retired (everything costs Wins now); pets of retired species are dropped.
  delete (merged as { gems?: number }).gems
  merged.pets = merged.pets.filter((p) => PET_BY_ID[p.petId])
  // Equipped pets must still exist in the inventory.
  const uids = new Set(merged.pets.map((p) => p.uid))
  merged.equippedPets = merged.equippedPets.filter((u) => uids.has(u))
  return merged
}
