/**
 * Trainers (pets), their rarities and the eggs ("?" lucky blocks) that hatch them.
 *
 * A hatched pet's rarity is rolled from the egg's odds; the species is then picked
 * uniformly from that egg's four. The bonus comes from rarity (and golden), the
 * species is the look.
 */

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const
export type Rarity = (typeof RARITIES)[number]

export interface RarityDef {
  id: Rarity
  name: string
  /** Additive power bonus: 0.05 = +5%. */
  bonus: number
  color: string
}

export const RARITY: Record<Rarity, RarityDef> = {
  common: { id: 'common', name: 'Common', bonus: 0.05, color: '#d9d9d9' },
  uncommon: { id: 'uncommon', name: 'Uncommon', bonus: 0.1, color: '#5ee05e' },
  rare: { id: 'rare', name: 'Rare', bonus: 0.25, color: '#3da5ff' },
  epic: { id: 'epic', name: 'Epic', bonus: 0.5, color: '#b04dff' },
  legendary: { id: 'legendary', name: 'Legendary', bonus: 1, color: '#ffb31a' },
  mythic: { id: 'mythic', name: 'Mythic', bonus: 2.5, color: '#ff2d6f' },
}

/** Rarity index (0 = common). Epic is index 3. */
export const rarityIndex = (r: Rarity): number => RARITIES.indexOf(r)

export const PETS_CONFIG = {
  baseSlots: 3,
  /** An extra equip slot at each of these rebirth counts. */
  extraSlotRebirths: [3, 10, 25] as readonly number[],
  maxSlots: 6,
  inventoryMax: 50,
  /** Five identical pets merge into one golden. */
  goldenMergeCount: 5,
  goldenMult: 2.5,
  /** Guaranteed Epic+ on this open if none dropped since the last one. */
  pityOpens: 40,
  /** Rebirths needed for "Open 3". */
  tripleOpenRebirths: 2,
} as const

/** Body shape used by the low-poly pet renderer. */
export type PetShape = 'bunny' | 'cat' | 'bear' | 'golem' | 'bird' | 'dragon' | 'ghost'

export interface PetDef {
  id: string
  name: string
  eggId: EggId | 'daily'
  shape: PetShape
  color: string
  accent: string
  /** Fixed rarity for pets that don't come from a rolled egg. */
  fixedRarity?: Rarity
}

export type EggId = 'yellow' | 'blue' | 'red' | 'purple' | 'black' | 'event'

export const PETS: readonly PetDef[] = [
  // Yellow Block
  { id: 'gym_bunny', name: 'Gym Bunny', eggId: 'yellow', shape: 'bunny', color: '#ffd1e8', accent: '#ff6fb5' },
  { id: 'pro_wrestler', name: 'Pro Wrestler', eggId: 'yellow', shape: 'bear', color: '#f2b38a', accent: '#d61f3c' },
  { id: 'boxing_coach', name: 'Boxing Coach', eggId: 'yellow', shape: 'bear', color: '#7a4b2a', accent: '#e8e8e8' },
  { id: 'sprint_cat', name: 'Sprint Cat', eggId: 'yellow', shape: 'cat', color: '#ffb347', accent: '#ffffff' },
  // Blue Block
  { id: 'ninja_cat', name: 'Ninja Cat', eggId: 'blue', shape: 'cat', color: '#2b2b3a', accent: '#ff3b3b' },
  { id: 'iron_golem', name: 'Iron Golem', eggId: 'blue', shape: 'golem', color: '#9aa3ad', accent: '#ff9b2f' },
  { id: 'yoga_panda', name: 'Yoga Panda', eggId: 'blue', shape: 'bear', color: '#f5f5f5', accent: '#222222' },
  { id: 'swim_seal', name: 'Swim Seal', eggId: 'blue', shape: 'ghost', color: '#9fd3ff', accent: '#2f6bff' },
  // Red Block
  { id: 'kick_roo', name: 'Kickbox Roo', eggId: 'red', shape: 'bunny', color: '#c98a4b', accent: '#ff2d55' },
  { id: 'lava_golem', name: 'Lava Golem', eggId: 'red', shape: 'golem', color: '#3a1208', accent: '#ff6a00' },
  { id: 'karate_fox', name: 'Karate Fox', eggId: 'red', shape: 'cat', color: '#ff7a1f', accent: '#ffffff' },
  { id: 'spartan_bear', name: 'Spartan Bear', eggId: 'red', shape: 'bear', color: '#8a5a2b', accent: '#ffcc33' },
  // Purple Block
  { id: 'dragon_coach', name: 'Dragon Coach', eggId: 'purple', shape: 'dragon', color: '#7b3dff', accent: '#ffe94a' },
  { id: 'thunder_hawk', name: 'Thunder Hawk', eggId: 'purple', shape: 'bird', color: '#2b2f4a', accent: '#ffe94a' },
  { id: 'shadow_ninja', name: 'Shadow Ninja', eggId: 'purple', shape: 'ghost', color: '#1c1428', accent: '#b04dff' },
  { id: 'crystal_golem', name: 'Crystal Golem', eggId: 'purple', shape: 'golem', color: '#ff9cf0', accent: '#ffffff' },
  // Black Block
  { id: 'void_dragon', name: 'Void Dragon', eggId: 'black', shape: 'dragon', color: '#120822', accent: '#5c2aff' },
  { id: 'cosmic_cat', name: 'Cosmic Cat', eggId: 'black', shape: 'cat', color: '#2a0a4a', accent: '#ff3df5' },
  { id: 'titan_golem', name: 'Titan Golem', eggId: 'black', shape: 'golem', color: '#ffd700', accent: '#ffffff' },
  { id: 'phoenix_coach', name: 'Phoenix Coach', eggId: 'black', shape: 'bird', color: '#ff7b00', accent: '#ffe066' },
  // Halloween event egg
  { id: 'pumpkin_pup', name: 'Pumpkin Pup', eggId: 'event', shape: 'bear', color: '#ff8a1f', accent: '#2b1a0a' },
  { id: 'witch_cat', name: 'Witch Cat', eggId: 'event', shape: 'cat', color: '#5b2a8f', accent: '#ff8a1f' },
  { id: 'ghost_coach', name: 'Ghost Coach', eggId: 'event', shape: 'ghost', color: '#f5f5ff', accent: '#7b3dff' },
  // Day-7 daily login exclusive
  {
    id: 'calendar_champ',
    name: 'Calendar Champ',
    eggId: 'daily',
    shape: 'bear',
    color: '#ffcc33',
    accent: '#ff2d55',
    fixedRarity: 'legendary',
  },
]

export const PET_BY_ID: Record<string, PetDef> = Object.fromEntries(PETS.map((p) => [p.id, p]))

export interface EggDef {
  id: EggId
  name: string
  /** Price, in `currency`. */
  cost: number
  currency: 'wins' | 'pumpkins'
  /** Best stage ever reached that unlocks this egg. 0 = always. */
  unlockStage: number
  /** Percent odds in RARITIES order: C/U/R/E/L/M. */
  odds: readonly [number, number, number, number, number, number]
  color: string
  /** Event egg only: chance (percent) to drop the VIP Boomerang if not yet owned. */
  vipChance?: number
}

export const EGGS: readonly EggDef[] = [
  { id: 'yellow', name: 'Yellow Block', cost: 1_500, currency: 'wins', unlockStage: 0, odds: [60, 25, 10, 4, 1, 0], color: '#ffd21f' },
  { id: 'blue', name: 'Blue Block', cost: 5_000, currency: 'wins', unlockStage: 0, odds: [45, 30, 15, 7, 2.5, 0.5], color: '#26b7ff' },
  { id: 'red', name: 'Red Block', cost: 16_000, currency: 'wins', unlockStage: 0, odds: [30, 30, 22, 12, 5, 1], color: '#ff2d3d' },
  { id: 'purple', name: 'Purple Block', cost: 150_000, currency: 'wins', unlockStage: 15, odds: [20, 25, 28, 17, 8, 2], color: '#a24dff' },
  { id: 'black', name: 'Black Block', cost: 2_000_000, currency: 'wins', unlockStage: 25, odds: [10, 20, 30, 25, 12, 3], color: '#222228' },
  {
    id: 'event',
    name: 'Halloween Egg',
    cost: 100,
    currency: 'pumpkins',
    unlockStage: 0,
    odds: [35, 30, 20, 10, 4, 1],
    color: '#7b2fbf',
    vipChance: 3,
  },
]

export const EGG_BY_ID: Record<EggId, EggDef> = Object.fromEntries(EGGS.map((e) => [e.id, e])) as Record<
  EggId,
  EggDef
>

export function petsOfEgg(eggId: EggId): PetDef[] {
  return PETS.filter((p) => p.eggId === eggId)
}

export function petSlots(rebirths: number): number {
  let slots = PETS_CONFIG.baseSlots
  for (const r of PETS_CONFIG.extraSlotRebirths) if (rebirths >= r) slots += 1
  return Math.min(slots, PETS_CONFIG.maxSlots)
}

export function petBonus(rarity: Rarity, golden: boolean): number {
  return RARITY[rarity].bonus * (golden ? PETS_CONFIG.goldenMult : 1)
}
