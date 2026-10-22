/**
 * Trainers (pets), their rarities and the egg that hatches them. Pets are a
 * Halloween event reward: the only egg is the Halloween Egg, bought with pumpkins.
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
  eggId: EggId
  shape: PetShape
  color: string
  accent: string
}

export type EggId = 'event'

export const PETS: readonly PetDef[] = [
  // Halloween event egg
  { id: 'pumpkin_pup', name: 'Pumpkin Pup', eggId: 'event', shape: 'bear', color: '#ff8a1f', accent: '#2b1a0a' },
  { id: 'witch_cat', name: 'Witch Cat', eggId: 'event', shape: 'cat', color: '#5b2a8f', accent: '#ff8a1f' },
  { id: 'ghost_coach', name: 'Ghost Coach', eggId: 'event', shape: 'ghost', color: '#f5f5ff', accent: '#7b3dff' },
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
