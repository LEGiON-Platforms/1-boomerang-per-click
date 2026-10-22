/**
 * Everything that keeps players around: boosts, playtime gifts, daily calendar,
 * quests, the gem shop, codes, badges, the Halloween event, offline earnings,
 * friend boost, the lucky block drop and the tutorial.
 */

import type { EggId, Rarity } from './pets'

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

export interface RewardDef {
  /** Wins worth this many clears of the player's best stage pad. */
  winsPads?: number
  gems?: number
  pumpkins?: number
  boosts?: ReadonlyArray<{ id: BoostId; minutes: number }>
  /** A free open of this egg, or of the best egg the player has unlocked. */
  egg?: EggId | 'best'
  pet?: { id: string; rarity: Rarity }
}

/* ---------------------------------------------------------------------------
 * Playtime gifts (reset each UTC day)
 * ------------------------------------------------------------------------- */

export interface GiftDef {
  minutes: number
  reward: RewardDef
}

export const PLAYTIME_GIFTS: readonly GiftDef[] = [
  { minutes: 1, reward: { gems: 10 } },
  { minutes: 3, reward: { winsPads: 3 } },
  { minutes: 5, reward: { boosts: [{ id: 'click3x', minutes: 10 }] } },
  { minutes: 8, reward: { gems: 10 } },
  { minutes: 12, reward: { boosts: [{ id: 'wins2x', minutes: 10 }] } },
  { minutes: 15, reward: { winsPads: 8 } },
  { minutes: 20, reward: { egg: 'best' } },
  { minutes: 30, reward: { gems: 25, boosts: [{ id: 'power2x', minutes: 15 }] } },
]

/* ---------------------------------------------------------------------------
 * Daily login calendar (7-day streak; missing a day resets to day 1)
 * ------------------------------------------------------------------------- */

export const DAILY_REWARDS: readonly RewardDef[] = [
  { gems: 10 },
  { winsPads: 5 },
  { gems: 5, boosts: [{ id: 'wins2x', minutes: 15 }] },
  { gems: 15 },
  { egg: 'best' },
  { gems: 20, boosts: [{ id: 'click3x', minutes: 20 }] },
  { gems: 30, pet: { id: 'calendar_champ', rarity: 'legendary' } },
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
  { id: 'd_throw', title: 'Throw 2,000 times', stat: 'throws', target: 2_000, reward: { gems: 10, winsPads: 3 } },
  { id: 'd_walls', title: 'Break 100 walls', stat: 'wallsBroken', target: 100, reward: { gems: 5, winsPads: 4 } },
  { id: 'd_stage', title: 'Clear Stage 5', stat: 'stageClear', target: 5, reward: { gems: 5, boosts: [{ id: 'wins2x', minutes: 10 }] } },
  { id: 'd_eggs', title: 'Open 3 eggs', stat: 'eggsOpened', target: 3, reward: { gems: 8 } },
  { id: 'd_pumpkins', title: 'Collect 15 pumpkins', stat: 'pumpkins', target: 15, reward: { gems: 10 } },
  { id: 'd_pads', title: 'Claim 10 Win Pads', stat: 'padsClaimed', target: 10, reward: { winsPads: 5 } },
  { id: 'd_play', title: 'Play for 20 minutes', stat: 'playMinutes', target: 20, reward: { gems: 5, boosts: [{ id: 'click3x', minutes: 10 }] } },
]

export const WEEKLY_QUESTS: readonly QuestDef[] = [
  { id: 'w_throw', title: 'Throw 25,000 times', stat: 'throws', target: 25_000, reward: { gems: 50 } },
  { id: 'w_walls', title: 'Break 1,000 walls', stat: 'wallsBroken', target: 1_000, reward: { gems: 40, winsPads: 20 } },
  { id: 'w_rebirth', title: 'Rebirth 2 times', stat: 'rebirths', target: 2, reward: { gems: 50, boosts: [{ id: 'power2x', minutes: 30 }] } },
  { id: 'w_eggs', title: 'Open 30 eggs', stat: 'eggsOpened', target: 30, reward: { gems: 40 } },
  { id: 'w_stage', title: 'Clear Stage 10', stat: 'stageClear', target: 10, reward: { gems: 40, egg: 'best' } },
  { id: 'w_play', title: 'Play for 3 hours', stat: 'playMinutes', target: 180, reward: { gems: 60 } },
]

export const QUESTS_PER_PERIOD = 3

/* ---------------------------------------------------------------------------
 * Gem shop (gems are earned only from gifts/quests/daily/lucky blocks — no real money)
 * ------------------------------------------------------------------------- */

export type GemItemId = 'power2x' | 'wins2x' | 'autoWin' | 'starterPack'

export interface GemItemDef {
  id: GemItemId
  name: string
  cost: number
  permanent: boolean
  reward?: RewardDef
}

export const GEM_SHOP: Record<GemItemId, GemItemDef> = {
  power2x: { id: 'power2x', name: '2x Power', cost: 60, permanent: true },
  wins2x: { id: 'wins2x', name: '2x Wins', cost: 120, permanent: true },
  autoWin: { id: 'autoWin', name: 'Auto Win', cost: 40, permanent: true },
  starterPack: {
    id: 'starterPack',
    name: 'Starter Pack',
    cost: 29,
    permanent: false,
    reward: {
      egg: 'blue',
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
  RELEASE: { gems: 25, boosts: [{ id: 'wins2x', minutes: 10 }] },
  '100LIKES': { gems: 10, boosts: [{ id: 'click3x', minutes: 15 }] },
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
