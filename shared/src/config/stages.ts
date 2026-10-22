/**
 * The 30 stages. Each stage's material sets its wall look; the HP and Win values
 * come from economy.ts.
 */

export type WallPattern =
  | 'studs'
  | 'planks'
  | 'concrete'
  | 'brick'
  | 'cobble'
  | 'marble'
  | 'panels'
  | 'facets'
  | 'magma'
  | 'frost'
  | 'energy'
  | 'stars'

export interface StageDef {
  /** 1-based stage number. */
  stage: number
  material: string
  /** Wall base colour (sRGB hex). */
  color: string
  /** Secondary colour used by the pattern (cracks, veins, glow lines). */
  accent: string
  pattern: WallPattern
  /** 0..1 self-illumination, for the fiery/energy materials. */
  glow: number
}

export const STAGES: readonly StageDef[] = [
  { stage: 1, material: 'Plastic', color: '#8fd3ff', accent: '#5ab0ff', pattern: 'studs', glow: 0 },
  { stage: 2, material: 'Wood', color: '#b07a52', accent: '#6e4428', pattern: 'planks', glow: 0 },
  { stage: 3, material: 'Concrete', color: '#d6d2cc', accent: '#77726b', pattern: 'concrete', glow: 0 },
  { stage: 4, material: 'Brick', color: '#c4553b', accent: '#e8d6c0', pattern: 'brick', glow: 0 },
  { stage: 5, material: 'Stone', color: '#8e8f93', accent: '#55565a', pattern: 'cobble', glow: 0 },
  { stage: 6, material: 'Marble', color: '#f3f0ea', accent: '#a7a3b8', pattern: 'marble', glow: 0 },
  { stage: 7, material: 'Copper', color: '#cf7a3d', accent: '#3fb59a', pattern: 'panels', glow: 0.05 },
  { stage: 8, material: 'Iron', color: '#8a9099', accent: '#4b4f56', pattern: 'panels', glow: 0 },
  { stage: 9, material: 'Steel', color: '#b8c3cf', accent: '#6f7c8a', pattern: 'panels', glow: 0.05 },
  { stage: 10, material: 'Gold', color: '#ffcc33', accent: '#c48a00', pattern: 'panels', glow: 0.2 },
  { stage: 11, material: 'Jade', color: '#46c08a', accent: '#1d7a52', pattern: 'marble', glow: 0.1 },
  { stage: 12, material: 'Emerald', color: '#18d46a', accent: '#0a7a3c', pattern: 'facets', glow: 0.25 },
  { stage: 13, material: 'Ruby', color: '#ff2d55', accent: '#8a0022', pattern: 'facets', glow: 0.25 },
  { stage: 14, material: 'Sapphire', color: '#2f6bff', accent: '#0d2b8a', pattern: 'facets', glow: 0.25 },
  { stage: 15, material: 'Amethyst', color: '#a24dff', accent: '#4c1690', pattern: 'facets', glow: 0.3 },
  { stage: 16, material: 'Diamond', color: '#bdf6ff', accent: '#55c8e6', pattern: 'facets', glow: 0.35 },
  { stage: 17, material: 'Obsidian', color: '#2a1f3d', accent: '#7a4dff', pattern: 'facets', glow: 0.15 },
  { stage: 18, material: 'Lava', color: '#3a1208', accent: '#ff6a00', pattern: 'magma', glow: 0.8 },
  { stage: 19, material: 'Ice', color: '#cdefff', accent: '#6cc6ff', pattern: 'frost', glow: 0.2 },
  { stage: 20, material: 'Thunder', color: '#2b2f4a', accent: '#ffe94a', pattern: 'energy', glow: 0.8 },
  { stage: 21, material: 'Shadow', color: '#1c1428', accent: '#7b3dff', pattern: 'energy', glow: 0.5 },
  { stage: 22, material: 'Crystal', color: '#ff9cf0', accent: '#ffffff', pattern: 'facets', glow: 0.5 },
  { stage: 23, material: 'Plasma', color: '#0f3b3a', accent: '#36ffd9', pattern: 'energy', glow: 0.9 },
  { stage: 24, material: 'Neon', color: '#16061f', accent: '#ff2bd6', pattern: 'energy', glow: 1 },
  { stage: 25, material: 'Galaxy', color: '#1b0f3d', accent: '#b98cff', pattern: 'stars', glow: 0.7 },
  { stage: 26, material: 'Void', color: '#07040d', accent: '#5c2aff', pattern: 'stars', glow: 0.6 },
  { stage: 27, material: 'Celestial', color: '#fff6d6', accent: '#ffc94a', pattern: 'stars', glow: 0.8 },
  { stage: 28, material: 'Dragon', color: '#0f5a2a', accent: '#ff5a1f', pattern: 'magma', glow: 0.7 },
  { stage: 29, material: 'Cosmic', color: '#2a0a4a', accent: '#ff3df5', pattern: 'stars', glow: 0.9 },
  { stage: 30, material: 'Infinity', color: '#ffffff', accent: '#ffd700', pattern: 'energy', glow: 1 },
]

export function stageDef(stage: number): StageDef {
  return STAGES[Math.min(Math.max(stage, 1), STAGES.length) - 1]
}
