/**
 * Boomerangs: bought with Wins, strictly in order, kept through Rebirth.
 * The best owned one is always equipped.
 */

export interface BoomerangDef {
  id: number
  name: string
  /** +Power per click before multipliers. */
  power: number
  /** Price in Wins. 0 = free starter. */
  cost: number
  /** Body colour (sRGB hex). */
  color: string
  /** 0 = matte, 1 = full glow. Higher tiers glow. */
  glow: number
}

export const BOOMERANGS: readonly BoomerangDef[] = [
  { id: 0, name: 'Wooden', power: 1, cost: 0, color: '#c98a4b', glow: 0 },
  { id: 1, name: 'Plastic', power: 2, cost: 28, color: '#4fb3ff', glow: 0 },
  { id: 2, name: 'Stone', power: 4, cost: 150, color: '#8d8f94', glow: 0 },
  { id: 3, name: 'Copper', power: 7, cost: 460, color: '#d27a3f', glow: 0 },
  { id: 4, name: 'Iron', power: 12, cost: 1_300, color: '#b7bec7', glow: 0 },
  { id: 5, name: 'Gold', power: 20, cost: 3_100, color: '#ffc824', glow: 0.15 },
  { id: 6, name: 'Emerald', power: 35, cost: 7_200, color: '#22d36b', glow: 0.25 },
  { id: 7, name: 'Ruby', power: 60, cost: 16_000, color: '#ff2d55', glow: 0.25 },
  { id: 8, name: 'Sapphire', power: 110, cost: 36_000, color: '#2f6bff', glow: 0.3 },
  { id: 9, name: 'Diamond', power: 200, cost: 77_000, color: '#9ff3ff', glow: 0.4 },
  { id: 10, name: 'Obsidian', power: 350, cost: 170_000, color: '#3b2a52', glow: 0.2 },
  { id: 11, name: 'Lava', power: 600, cost: 380_000, color: '#ff5a1f', glow: 0.6 },
  { id: 12, name: 'Frost', power: 1_000, cost: 850_000, color: '#bfe9ff', glow: 0.5 },
  { id: 13, name: 'Thunder', power: 1_800, cost: 1_900_000, color: '#ffe94a', glow: 0.7 },
  { id: 14, name: 'Shadow', power: 3_200, cost: 4_200_000, color: '#5b2a8f', glow: 0.5 },
  { id: 15, name: 'Crystal', power: 5_500, cost: 9_300_000, color: '#ff8af2', glow: 0.6 },
  { id: 16, name: 'Plasma', power: 10_000, cost: 21_000_000, color: '#36ffd9', glow: 0.8 },
  { id: 17, name: 'Galaxy', power: 18_000, cost: 47_000_000, color: '#7b5cff', glow: 0.8 },
  { id: 18, name: 'Void', power: 32_000, cost: 100_000_000, color: '#1a0b2e', glow: 0.6 },
  { id: 19, name: 'Celestial', power: 55_000, cost: 230_000_000, color: '#fff3b0', glow: 0.9 },
  { id: 20, name: 'Phoenix', power: 100_000, cost: 510_000_000, color: '#ff7b00', glow: 1 },
  { id: 21, name: 'Dragon', power: 180_000, cost: 1_100_000_000, color: '#00c853', glow: 0.9 },
  { id: 22, name: 'Cosmic', power: 320_000, cost: 2_500_000_000, color: '#ff3df5', glow: 1 },
  { id: 23, name: 'Infinity', power: 550_000, cost: 5_500_000_000, color: '#ffffff', glow: 1 },
  { id: 24, name: 'Godly', power: 1_000_000, cost: 12_000_000_000, color: '#ffd700', glow: 1 },
]

/** Event-only boomerang: always 1.5x the power of your best owned boomerang. */
export const VIP_BOOMERANG = {
  name: 'VIP Boomerang',
  multiplier: 1.5,
  color: '#ffb300',
  glow: 1,
} as const
