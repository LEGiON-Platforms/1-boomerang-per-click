/**
 * Network protocol between client and the Colyseus GameRoom.
 *
 * Public, per-room data (positions, cosmetics) is synced through the room's Schema
 * state. Private data (wins, inventory, wall HP) is only ever sent to its owner
 * with `client.send`, using the S2C messages below.
 */

import type { EggId, Rarity } from './config/pets'
import type { BadgeId, PerkId } from './config/retention'
import type { ErrorCode } from './errors'
import type { RewardSummary } from './logic/actions'
import type { PetInstance, PlayerData } from './types'

export const ROOM_NAME = 'game'
export const MAX_CLIENTS = 8
/** Client → server position updates per second. */
export const MOVE_RATE_HZ = 10
/** Seconds the server holds a dropped player's seat. */
export const RECONNECT_SECONDS = 20

/* ---------------------------------------------------------------------------
 * Join
 * ------------------------------------------------------------------------- */

export interface JoinOptions {
  /** Secret guest account key (UUID kept in localStorage). Never shown to others. */
  playerId: string
  name: string
}

/** Valid guest account keys: 16–64 chars of [A-Za-z0-9_-]. */
export const PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/

export function sanitizeName(raw: unknown): string {
  const cleaned = String(raw ?? '')
    .replace(/[^A-Za-z0-9_ ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20)
  return cleaned.length >= 3 ? cleaned : ''
}

/* ---------------------------------------------------------------------------
 * Bloxity avatar looks, relayed so every player sees everyone's real avatar
 * ------------------------------------------------------------------------- */

/** Equipped-cosmetic id keys from the Bloxity SDK's avatar.getEquipped(). */
export const AVATAR_ID_KEYS = [
  'hatId', 'backId', 'skinId', 'headId', 'armLId', 'armRId', 'legLId', 'legRId', 'torsoId',
  'hairId', 'maskId', 'neckId', 'chestId', 'waistId', 'handId', 'shoesId', 'pantsId', 'shirtId', 'faceId',
] as const
/** Body proportions from avatar.getProportions(). */
export const AVATAR_PROPORTION_KEYS = [
  'height', 'shoulderWidth', 'armLength', 'legOffsetX', 'torsoScaleX', 'neckHeight', 'headScale',
] as const

export interface AvatarLook {
  /** Equipped ids, only the slots that are set. */
  e: Partial<Record<(typeof AVATAR_ID_KEYS)[number], string>>
  /** Proportions, only those that differ from 1. */
  p: Partial<Record<(typeof AVATAR_PROPORTION_KEYS)[number], number>>
}

const AVATAR_ID = /^[A-Za-z0-9_-]{1,48}$/

/** Validates a look from a client and returns it as compact JSON ('' if unusable). */
export function sanitizeAvatarLook(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return ''
  const src = raw as { e?: Record<string, unknown>; p?: Record<string, unknown> }
  const look: AvatarLook = { e: {}, p: {} }
  for (const key of AVATAR_ID_KEYS) {
    const v = src.e?.[key]
    if (v === undefined || v === null) continue
    const id = String(v)
    if (AVATAR_ID.test(id) && id !== '-1') look.e[key] = id
  }
  for (const key of AVATAR_PROPORTION_KEYS) {
    const v = Number(src.p?.[key])
    if (!Number.isFinite(v) || v === 1) continue
    look.p[key] = Math.round(Math.min(2, Math.max(0.5, v)) * 1000) / 1000
  }
  return JSON.stringify(look)
}

/** Parses a relayed look ('' or bad JSON = the default avatar). */
export function parseAvatarLook(json: string): AvatarLook {
  if (!json) return { e: {}, p: {} }
  try {
    const look = JSON.parse(json) as AvatarLook
    return { e: look.e ?? {}, p: look.p ?? {} }
  } catch {
    return { e: {}, p: {} }
  }
}

/* ---------------------------------------------------------------------------
 * Client → server
 * ------------------------------------------------------------------------- */

export const C2S = {
  move: 'move',
  throw: 'throw',
  buyBoomerang: 'buyBoomerang',
  buyTrail: 'buyTrail',
  equipTrail: 'equipTrail',
  openEgg: 'openEgg',
  equipPet: 'equipPet',
  unequipPet: 'unequipPet',
  equipBestPets: 'equipBestPets',
  mergePets: 'mergePets',
  deletePet: 'deletePet',
  rebirth: 'rebirth',
  claimPad: 'claimPad',
  claimGift: 'claimGift',
  claimDaily: 'claimDaily',
  claimQuest: 'claimQuest',
  redeemCode: 'redeemCode',
  teleportStage: 'teleportStage',
  teleportPad: 'teleportPad',
  claimLuckyBlock: 'claimLuckyBlock',
  collectPumpkin: 'collectPumpkin',
  buyPerk: 'buyPerk',
  addFriend: 'addFriend',
  removeFriend: 'removeFriend',
  setName: 'setName',
  setAvatar: 'setAvatar',
  rollTutorialReward: 'rollTutorialReward',
  requestSync: 'requestSync',
} as const

/** Animation state carried in move updates. */
export const ANIM = { idle: 0, walk: 1, run: 2, jump: 3 } as const

export interface MoveMsg {
  x: number
  y: number
  z: number
  /** Facing (radians). */
  r: number
  /** ANIM value. */
  a: number
}

export interface ThrowMsg {
  /** Client sequence number, echoed in ThrowResult. */
  s: number
}

export interface OpenEggMsg {
  egg: EggId
  count: 1 | 3
}

/* ---------------------------------------------------------------------------
 * Server → client
 * ------------------------------------------------------------------------- */

export const S2C = {
  welcome: 'welcome',
  self: 'self',
  throwResult: 'throwResult',
  run: 'run',
  teleport: 'teleport',
  error: 'error',
  toast: 'toast',
  badge: 'badge',
  eggResult: 'eggResult',
  reward: 'reward',
  padClaimed: 'padClaimed',
  leaderboards: 'leaderboards',
  luckyWinner: 'luckyWinner',
  offline: 'offline',
  levelUp: 'levelUp',
  tutorialReward: 'tutorialReward',
  purchase: 'purchase',
  rebirthDone: 'rebirthDone',
} as const

/** The active stage run, as the owner sees it. */
export interface RunState {
  stage: number
  wallsBroken: number
  wallHp: number
  wallMax: number
  padClaimed: boolean
}

export interface SelfMsg {
  /** Server clock at send time, for client-side countdowns. */
  serverNow: number
  data: PlayerData
  /** Public id other players see for this player (friends list key). */
  publicId: string
}

export interface WelcomeMsg extends SelfMsg {
  run: RunState
  leaderboards: LeaderboardsMsg
  roomId: string
}

/** Throw targets. */
export const TARGET = { none: 0, dummy: 1, wall: 2 } as const

export interface ThrowResultMsg {
  s: number
  /** Power gained by this throw. */
  g: number
  /** Power after the throw. */
  p: number
  /** TARGET value. */
  t: number
  /** Training pad hit (when t = dummy). */
  pad?: number
  /** Wall hit details (when t = wall). */
  hit?: { damage: number; broken: boolean; winsGained: number; wall: number; unlocked: number }
  run?: RunState
  /** Current wins (changes when a wall break pays out). */
  w?: number
}

export interface TeleportMsg {
  x: number
  z: number
  rotY: number
}

export interface ErrorMsg {
  code: ErrorCode
}

export interface ToastMsg {
  text: string
  kind: 'info' | 'success' | 'error'
}

export interface BadgeMsg {
  id: BadgeId
}

export interface EggResultMsg {
  egg: EggId
  pets: PetInstance[]
  vip: boolean
  /** Opened for free (lucky block / gift / offer). */
  free: boolean
}

export type RewardSource = 'gift' | 'daily' | 'quest' | 'code' | 'perk' | 'lucky'

export interface RewardMsg {
  source: RewardSource
  title: string
  reward: RewardSummary
}

export interface PadClaimedMsg {
  stage: number
  wins: number
}

export interface LeaderboardEntry {
  name: string
  value: number
}

export interface LeaderboardsMsg {
  wins: LeaderboardEntry[]
  stage: LeaderboardEntry[]
  rebirths: LeaderboardEntry[]
  updatedAt: number
}

export interface LuckyWinnerMsg {
  name: string
  petName: string
  rarity: Rarity | null
  vip: boolean
}

export interface OfflineMsg {
  minutes: number
  wins: number
}

export interface PurchaseMsg {
  kind: 'boomerang' | 'trail' | 'perk'
  id: number | PerkId
}

export interface TutorialRewardMsg {
  index: number
}

/* ---------------------------------------------------------------------------
 * Synced room state field codes
 * ------------------------------------------------------------------------- */

/** LuckyBlock.phase values. */
export const LUCKY_PHASE = { countdown: 0, active: 1 } as const

/** A pet as listed in the public PlayerState.pets array: "petId:rarityIndex:golden". */
export function encodePublicPet(p: PetInstance, rarityIdx: number): string {
  return `${p.petId}:${rarityIdx}:${p.golden ? 1 : 0}`
}

export function decodePublicPet(s: string): { petId: string; rarity: number; golden: boolean } {
  const [petId, r, g] = s.split(':')
  return { petId, rarity: Number(r) || 0, golden: g === '1' }
}
