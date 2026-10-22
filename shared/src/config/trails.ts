/**
 * Trails: a Wins purchase that multiplies click gain and draws a glowing path
 * behind thrown boomerangs (out and back, with an aura round the boomerang) and
 * behind the walking player. Every trail has its own look (`style`).
 */

/** How a trail is drawn — each shop trail has a different one. */
export type TrailStyle =
  | 'breeze'
  | 'bubbles'
  | 'zap'
  | 'wave'
  | 'comet'
  | 'helix'
  | 'sparkle'
  | 'flame'
  | 'aurora'
  | 'nebula'
  | 'rainbow'
  | 'cosmic'

export interface TrailDef {
  id: number
  name: string
  mult: number
  /** Price in Wins. 0 = free starter. */
  cost: number
  /** Gradient head → tail (sRGB hex). */
  colors: readonly [string, string]
  style: TrailStyle
  /** Shown under the name in the shop. */
  styleName: string
  /** Aura round the flying boomerang (sRGB hex). */
  glow: string
}

export const TRAILS: readonly TrailDef[] = [
  { id: 0, name: 'Breeze', mult: 1.0, cost: 0, colors: ['#e6f6ff', '#5fb0ff'], style: 'breeze', styleName: 'Wind Wisp', glow: '#cfeaff' },
  { id: 1, name: 'Bubblegum', mult: 1.06, cost: 8, colors: ['#ff8ad8', '#ff4fb0'], style: 'bubbles', styleName: 'Bubbles', glow: '#ff9ee0' },
  { id: 2, name: 'Lime Zest', mult: 1.13, cost: 20, colors: ['#d8ff6a', '#7ed321'], style: 'zap', styleName: 'Electric Zap', glow: '#e6ff7a' },
  { id: 3, name: 'Ocean', mult: 1.2, cost: 45, colors: ['#6ae4ff', '#1e6bff'], style: 'wave', styleName: 'Wave', glow: '#7fe9ff' },
  { id: 4, name: 'Sunset', mult: 1.3, cost: 120, colors: ['#ffd36a', '#ff4d4d'], style: 'comet', styleName: 'Comet', glow: '#ffb347' },
  { id: 5, name: 'Mint', mult: 1.45, cost: 400, colors: ['#c8fff0', '#2ee6a6'], style: 'helix', styleName: 'Double Helix', glow: '#8dffd8' },
  { id: 6, name: 'Royal', mult: 1.6, cost: 1_500, colors: ['#c9a6ff', '#6a1bff'], style: 'sparkle', styleName: 'Sparkles', glow: '#d6b8ff' },
  { id: 7, name: 'Inferno', mult: 1.8, cost: 6_000, colors: ['#ffe066', '#ff2200'], style: 'flame', styleName: 'Flames', glow: '#ff8a1f' },
  { id: 8, name: 'Aurora', mult: 2.0, cost: 25_000, colors: ['#7affc1', '#b26bff'], style: 'aurora', styleName: 'Aurora', glow: '#9dffd2' },
  { id: 9, name: 'Nebula', mult: 2.3, cost: 120_000, colors: ['#ff6bd6', '#3a2bff'], style: 'nebula', styleName: 'Nebula Cloud', glow: '#ff8ae8' },
  { id: 10, name: 'Rainbow', mult: 2.6, cost: 600_000, colors: ['#ff3b3b', '#3bd1ff'], style: 'rainbow', styleName: 'Rainbow', glow: '#ffffff' },
  { id: 11, name: 'Cosmic', mult: 3.0, cost: 3_000_000, colors: ['#ffffff', '#ff00e6'], style: 'cosmic', styleName: 'Cosmic Helix', glow: '#ff7af2' },
]
