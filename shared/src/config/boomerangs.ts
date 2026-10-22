/**
 * Boomerangs: bought with Wins, strictly in order, kept through Rebirth.
 * The best owned one is always equipped. Twenty-five of them; Power and prices
 * are the design table (not tuned — the tuner balances around them).
 */

/** Body silhouette of the 3D model (see client/src/game/boomerangShapes.ts). */
export type BoomerangShape = 'classic' | 'hook' | 'scythe' | 'tri' | 'cross' | 'star'

/** Surface finish: where the accent colour goes. */
export type BoomerangPattern = 'plain' | 'grain' | 'tips' | 'bands' | 'stripes' | 'core' | 'split' | 'rainbow'

export interface BoomerangDef {
  id: number
  name: string
  /** +Power per click before multipliers. */
  power: number
  /** Price in Wins. 0 = free starter. */
  cost: number
  /** Body colour (sRGB hex). */
  color: string
  /** Tips, stripes and gem colour (sRGB hex). */
  accent: string
  /** 0 = matte, 1 = full glow. Higher tiers glow. */
  glow: number
  shape: BoomerangShape
  pattern: BoomerangPattern
}

export const BOOMERANGS: readonly BoomerangDef[] = [
  { id: 0, name: 'Wooden', power: 1, cost: 0, color: '#c98a4b', accent: '#7a4b2a', glow: 0, shape: 'classic', pattern: 'grain' },
  { id: 1, name: 'Plastic', power: 2, cost: 3, color: '#4fb3ff', accent: '#ffffff', glow: 0, shape: 'classic', pattern: 'tips' },
  { id: 2, name: 'Stone', power: 4, cost: 15, color: '#8d8f94', accent: '#55565a', glow: 0, shape: 'hook', pattern: 'grain' },
  { id: 3, name: 'Copper', power: 7, cost: 40, color: '#d27a3f', accent: '#3fb59a', glow: 0, shape: 'hook', pattern: 'bands' },
  { id: 4, name: 'Iron', power: 12, cost: 100, color: '#b7bec7', accent: '#5b6470', glow: 0, shape: 'hook', pattern: 'bands' },
  { id: 5, name: 'Gold', power: 20, cost: 220, color: '#ffc824', accent: '#fff3b0', glow: 0.15, shape: 'classic', pattern: 'bands' },
  { id: 6, name: 'Emerald', power: 35, cost: 450, color: '#22d36b', accent: '#0a7a3c', glow: 0.25, shape: 'tri', pattern: 'tips' },
  { id: 7, name: 'Ruby', power: 60, cost: 900, color: '#ff2d55', accent: '#8a0022', glow: 0.25, shape: 'tri', pattern: 'core' },
  { id: 8, name: 'Sapphire', power: 110, cost: 1_800, color: '#2f6bff', accent: '#0d2b8a', glow: 0.3, shape: 'tri', pattern: 'bands' },
  { id: 9, name: 'Diamond', power: 200, cost: 3_500, color: '#9ff3ff', accent: '#ffffff', glow: 0.4, shape: 'tri', pattern: 'core' },
  { id: 10, name: 'Obsidian', power: 350, cost: 7_000, color: '#3b2a52', accent: '#b04dff', glow: 0.2, shape: 'scythe', pattern: 'stripes' },
  { id: 11, name: 'Lava', power: 600, cost: 14_000, color: '#ff7b00', accent: '#ffe066', glow: 0.7, shape: 'scythe', pattern: 'split' },
  { id: 12, name: 'Frost', power: 1_000, cost: 28_000, color: '#bfe9ff', accent: '#5cc8ff', glow: 0.5, shape: 'scythe', pattern: 'tips' },
  { id: 13, name: 'Thunder', power: 1_800, cost: 55_000, color: '#ffe94a', accent: '#3a3f6a', glow: 0.7, shape: 'scythe', pattern: 'stripes' },
  { id: 14, name: 'Shadow', power: 3_200, cost: 110_000, color: '#5b2a8f', accent: '#1c1428', glow: 0.5, shape: 'hook', pattern: 'split' },
  { id: 15, name: 'Crystal', power: 5_500, cost: 220_000, color: '#ff8af2', accent: '#ffffff', glow: 0.6, shape: 'cross', pattern: 'tips' },
  { id: 16, name: 'Plasma', power: 10_000, cost: 450_000, color: '#36ffd9', accent: '#0f3b3a', glow: 0.8, shape: 'cross', pattern: 'stripes' },
  { id: 17, name: 'Galaxy', power: 18_000, cost: 900_000, color: '#7b5cff', accent: '#ffe14a', glow: 0.8, shape: 'star', pattern: 'tips' },
  { id: 18, name: 'Void', power: 32_000, cost: 1_800_000, color: '#1a0b2e', accent: '#5c2aff', glow: 0.6, shape: 'star', pattern: 'core' },
  { id: 19, name: 'Celestial', power: 55_000, cost: 3_600_000, color: '#fff3b0', accent: '#ffc94a', glow: 0.9, shape: 'star', pattern: 'bands' },
  { id: 20, name: 'Phoenix', power: 100_000, cost: 7_000_000, color: '#ff7b00', accent: '#ffd21f', glow: 1, shape: 'scythe', pattern: 'stripes' },
  { id: 21, name: 'Dragon', power: 180_000, cost: 14_000_000, color: '#00c853', accent: '#ffd700', glow: 0.9, shape: 'hook', pattern: 'bands' },
  { id: 22, name: 'Cosmic', power: 320_000, cost: 28_000_000, color: '#ff3df5', accent: '#36d9ff', glow: 1, shape: 'star', pattern: 'split' },
  { id: 23, name: 'Infinity', power: 550_000, cost: 55_000_000, color: '#ffffff', accent: '#b98cff', glow: 1, shape: 'star', pattern: 'rainbow' },
  { id: 24, name: 'Godly', power: 1_000_000, cost: 110_000_000, color: '#ffd700', accent: '#ffffff', glow: 1, shape: 'star', pattern: 'bands' },
]

/** Event-only boomerang: always 1.5x the power of your best owned boomerang. */
export const VIP_BOOMERANG = {
  name: 'VIP Boomerang',
  multiplier: 1.5,
  color: '#ffb300',
  accent: '#ff3df5',
  glow: 1,
  shape: 'star' as BoomerangShape,
  pattern: 'split' as BoomerangPattern,
} as const
