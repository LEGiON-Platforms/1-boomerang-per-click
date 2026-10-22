/**
 * Everything that keeps players around: boosts, playtime gifts, daily calendar,
 * quests, the perk shop, codes, badges, the Halloween event, offline earnings,
 * friend boost, the lucky block drop and the tutorial.
 */

import type { Rarity } from './pets'

/* ---------------------------------------------------------------------------
 * Boosts
 * ------------------------------------------------------------------------- */

export type BoostId = 'click3x' | 'power2x' | 'wins2x' | 'training2x'

export interface BoostDef {
  id: BoostId
  name: string
  mult: number
  color: string
}

export const BOOSTS: Record<BoostId, BoostDef> = {
  click3x: { id: 'click3x', name: '3x Click Power', mult: 3, color: '#ff5ad1' },
  power2x: { id: 'power2x', name: '2x Power', mult: 2, color: '#ff8a1f' },
  wins2x: { id: 'wins2x', name: '2x Wins', mult: 2, color: '#ffd21f' },
  training2x: { id: 'training2x', name: '2x Training', mult: 2, color: '#2ee66b' },
}

/** Stacking a boost extends its timer, up to this many minutes remaining. */
export const BOOST_MAX_MINUTES = 120

/* ---------------------------------------------------------------------------
 * Rewards (gifts, daily, quests, codes, offers)
 * ------------------------------------------------------------------------- */

/**
 * Everything in the game is bought with Wins (pets with pumpkins), so rewards pay
 * Wins — scaled to the player's progress — pumpkins and boosts.
 */
export interface RewardDef {
  /** Wins worth this many clears of the player's best stage pad. */
  winsPads?: number
  pumpkins?: number
  boosts?: ReadonlyArray<{ id: BoostId; minutes: number }>
}

/* ---------------------------------------------------------------------------
 * Playtime gifts (reset each UTC day)
 * ------------------------------------------------------------------------- */

export interface GiftDef {
  minutes: number
  reward: RewardDef
}

export const PLAYTIME_GIFTS: readonly GiftDef[] = [
  { minutes: 1, reward: { winsPads: 2 } },
  { minutes: 3, reward: { winsPads: 3 } },
  { minutes: 5, reward: { boosts: [{ id: 'click3x', minutes: 10 }] } },
  { minutes: 8, reward: { winsPads: 4 } },
  { minutes: 12, reward: { boosts: [{ id: 'wins2x', minutes: 10 }] } },
  { minutes: 15, reward: { winsPads: 8 } },
  { minutes: 20, reward: { winsPads: 10, pumpkins: 10 } },
  { minutes: 30, reward: { winsPads: 12, boosts: [{ id: 'power2x', minutes: 15 }] } },
]

/* ---------------------------------------------------------------------------
 * Daily login calendar (7-day streak; missing a day resets to day 1)
 * ------------------------------------------------------------------------- */

export const DAILY_REWARDS: readonly RewardDef[] = [
  { winsPads: 3 },
  { winsPads: 5 },
  { winsPads: 3, boosts: [{ id: 'wins2x', minutes: 15 }] },
  { winsPads: 8 },
  { pumpkins: 25 },
  { winsPads: 8, boosts: [{ id: 'click3x', minutes: 20 }] },
  { winsPads: 20, pumpkins: 50, boosts: [{ id: 'power2x', minutes: 30 }] },
]

/* ---------------------------------------------------------------------------
 * Quests
 * ------------------------------------------------------------------------- */

export type QuestStat =
  | 'throws'
  | 'wallsBroken'
  | 'stageClear'
  | 'eggsOpened'
  | 'pumpkins'
  | 'padsClaimed'
  | 'rebirths'
  | 'playMinutes'

export interface QuestDef {
  id: string
  title: string
  stat: QuestStat
  /** For `stageClear` this is the stage number to clear; otherwise a count. */
  target: number
  reward: RewardDef
}

export const DAILY_QUESTS: readonly QuestDef[] = [
  { id: 'd_throw', title: 'Throw 2,000 times', stat: 'throws', target: 2_000, reward: { winsPads: 5 } },
  { id: 'd_walls', title: 'Break 100 walls', stat: 'wallsBroken', target: 100, reward: { winsPads: 5 } },
  { id: 'd_stage', title: 'Clear Stage 5', stat: 'stageClear', target: 5, reward: { winsPads: 2, boosts: [{ id: 'wins2x', minutes: 10 }] } },
  { id: 'd_eggs', title: 'Open a Halloween Egg', stat: 'eggsOpened', target: 1, reward: { winsPads: 3 } },
  { id: 'd_pumpkins', title: 'Collect 15 pumpkins', stat: 'pumpkins', target: 15, reward: { pumpkins: 15 } },
  { id: 'd_pads', title: 'Claim 10 Win Pads', stat: 'padsClaimed', target: 10, reward: { winsPads: 5 } },
  { id: 'd_play', title: 'Play for 20 minutes', stat: 'playMinutes', target: 20, reward: { winsPads: 2, boosts: [{ id: 'click3x', minutes: 10 }] } },
]

export const WEEKLY_QUESTS: readonly QuestDef[] = [
  { id: 'w_throw', title: 'Throw 25,000 times', stat: 'throws', target: 25_000, reward: { winsPads: 15 } },
  { id: 'w_walls', title: 'Break 1,000 walls', stat: 'wallsBroken', target: 1_000, reward: { winsPads: 30 } },
  { id: 'w_rebirth', title: 'Rebirth 2 times', stat: 'rebirths', target: 2, reward: { winsPads: 15, boosts: [{ id: 'power2x', minutes: 30 }] } },
  { id: 'w_eggs', title: 'Open 5 Halloween Eggs', stat: 'eggsOpened', target: 5, reward: { winsPads: 12, pumpkins: 50 } },
  { id: 'w_stage', title: 'Clear Stage 10', stat: 'stageClear', target: 10, reward: { winsPads: 15 } },
  { id: 'w_play', title: 'Play for 3 hours', stat: 'playMinutes', target: 180, reward: { winsPads: 20 } },
]

export const QUESTS_PER_PERIOD = 3

/* ---------------------------------------------------------------------------
 * Perk shop (Shop → Boosts): permanent upgrades, bought with Wins
 * ------------------------------------------------------------------------- */

export type PerkId = 'power2x' | 'wins2x' | 'autoWin' | 'starterPack'

export interface PerkDef {
  id: PerkId
  name: string
  /** Price in Wins. Priced against the progression curve (see README "Balance"). */
  cost: number
  permanent: boolean
  reward?: RewardDef
}

export const PERK_SHOP: Record<PerkId, PerkDef> = {
  /** ≈ Stage 10, about an hour in. */
  autoWin: { id: 'autoWin', name: 'Auto Win', cost: 2_000, permanent: true },
  /** ≈ Stage 15, three to four hours in. */
  power2x: { id: 'power2x', name: '2x Power', cost: 25_000, permanent: true },
  /** ≈ Stage 19–20, about seven hours in. */
  wins2x: { id: 'wins2x', name: '2x Wins', cost: 150_000, permanent: true },
  starterPack: {
    id: 'starterPack',
    name: 'Starter Pack',
    cost: 3,
    permanent: false,
    reward: {
      boosts: [
        { id: 'wins2x', minutes: 30 },
        { id: 'click3x', minutes: 30 },
      ],
    },
  },
}

/** The Starter Pack is only offered for this long after a player's first join. */
export const STARTER_PACK_WINDOW_MINUTES = 10

/* ---------------------------------------------------------------------------
 * Codes
 * ------------------------------------------------------------------------- */

export const CODES: Record<string, RewardDef> = {
  RELEASE: { winsPads: 5, boosts: [{ id: 'wins2x', minutes: 10 }] },
  '100LIKES': { winsPads: 3, boosts: [{ id: 'click3x', minutes: 15 }] },
  HALLOWEEN: { pumpkins: 50 },
  SPOOKY: { boosts: [{ id: 'power2x', minutes: 15 }] },
}

export const LIKE_GOAL = { current: 190, target: 200, code: '100LIKES' } as const

/* ---------------------------------------------------------------------------
 * Badges
 * ------------------------------------------------------------------------- */

export type BadgeId =
  | 'first_throw'
  | 'power_100'
  | 'stage_5'
  | 'stage_10'
  | 'stage_20'
  | 'stage_30'
  | 'first_rebirth'
  | 'first_legendary'

export const BADGES: Record<BadgeId, { id: BadgeId; name: string; description: string }> = {
  first_throw: { id: 'first_throw', name: 'First Throw', description: 'Threw your first boomerang' },
  power_100: { id: 'power_100', name: '100 Power', description: 'Reached 100 Power' },
  stage_5: { id: 'stage_5', name: 'Stage 5', description: 'Cleared Stage 5' },
  stage_10: { id: 'stage_10', name: 'Stage 10', description: 'Cleared Stage 10' },
  stage_20: { id: 'stage_20', name: 'Stage 20', description: 'Cleared Stage 20' },
  stage_30: { id: 'stage_30', name: 'Stage 30', description: 'Cleared Stage 30' },
  first_rebirth: { id: 'first_rebirth', name: 'Reborn', description: 'Rebirthed for the first time' },
  first_legendary: { id: 'first_legendary', name: 'Legendary!', description: 'Hatched a Legendary pet' },
}

/* ---------------------------------------------------------------------------
 * Halloween event, offline earnings, friends, lucky block
 * ------------------------------------------------------------------------- */

export const HALLOWEEN = {
  enabled: true,
  /** Per-player respawn after a pumpkin is collected. */
  pumpkinRespawnSeconds: 60,
  pumpkinValue: 1,
  /** Pick-up radius (world units), checked on the server. */
  pickupRadius: 2.2,
} as const

export const OFFLINE = {
  /** Shorter absences earn nothing. */
  minAwayMinutes: 5,
  maxHours: 8,
  /** Fraction of the player's average active wins/minute. */
  fraction: 0.1,
} as const

export const FRIEND_BOOST = { perFriend: 0.05, max: 0.25 } as const

export const LUCKY_BLOCK = {
  /** Countdown between drops. */
  intervalSeconds: 120,
  /** How long a dropped block waits to be found. */
  activeSeconds: 90,
  touchRadius: 3,
} as const

/* ---------------------------------------------------------------------------
 * Tutorial
 * ------------------------------------------------------------------------- */

export const TUTORIAL = {
  trainPower: 10,
  /** Wins needed for the trail-purchase step (the Bubblegum trail's price). */
  trailId: 1,
} as const

export interface TutorialRewardOption {
  label: string
  rarity: Rarity
  weight: number
  boost: { id: BoostId; minutes: number }
}

export const TUTORIAL_REWARDS: readonly TutorialRewardOption[] = [
  { label: '2x Wins', rarity: 'common', weight: 55, boost: { id: 'wins2x', minutes: 5 } },
  { label: '2x Training', rarity: 'common', weight: 55, boost: { id: 'training2x', minutes: 5 } },
  { label: '2x Wins', rarity: 'rare', weight: 30, boost: { id: 'wins2x', minutes: 10 } },
  { label: '2x Power', rarity: 'epic', weight: 14, boost: { id: 'power2x', minutes: 15 } },
  { label: '3x Click Power', rarity: 'legendary', weight: 1, boost: { id: 'click3x', minutes: 10 } },
]
