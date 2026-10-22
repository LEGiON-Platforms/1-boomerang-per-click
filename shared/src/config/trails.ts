/** Trails: a Wins purchase that multiplies click gain and draws behind boomerang + player. */

export interface TrailDef {
  id: number
  name: string
  mult: number
  /** Price in Wins. 0 = free starter. */
  cost: number
  /** Gradient head → tail (sRGB hex). */
  colors: readonly [string, string]
}

export const TRAILS: readonly TrailDef[] = [
  { id: 0, name: 'Breeze', mult: 1.0, cost: 0, colors: ['#ffffff', '#a8d8ff'] },
  { id: 1, name: 'Bubblegum', mult: 1.06, cost: 8, colors: ['#ff8ad8', '#ff4fb0'] },
  { id: 2, name: 'Lime Zest', mult: 1.13, cost: 20, colors: ['#d8ff6a', '#7ed321'] },
  { id: 3, name: 'Ocean', mult: 1.2, cost: 45, colors: ['#6ae4ff', '#1e6bff'] },
  { id: 4, name: 'Sunset', mult: 1.3, cost: 120, colors: ['#ffd36a', '#ff4d4d'] },
  { id: 5, name: 'Mint', mult: 1.45, cost: 400, colors: ['#c8fff0', '#2ee6a6'] },
  { id: 6, name: 'Royal', mult: 1.6, cost: 1_500, colors: ['#c9a6ff', '#6a1bff'] },
  { id: 7, name: 'Inferno', mult: 1.8, cost: 6_000, colors: ['#ffe066', '#ff2200'] },
  { id: 8, name: 'Aurora', mult: 2.0, cost: 25_000, colors: ['#7affc1', '#b26bff'] },
  { id: 9, name: 'Nebula', mult: 2.3, cost: 120_000, colors: ['#ff6bd6', '#3a2bff'] },
  { id: 10, name: 'Rainbow', mult: 2.6, cost: 600_000, colors: ['#ff3b3b', '#3bd1ff'] },
  { id: 11, name: 'Cosmic', mult: 3.0, cost: 3_000_000, colors: ['#ffffff', '#ff00e6'] },
]
