/** Training pads in the lobby. Standing on one multiplies click gain. */

export interface TrainingPadDef {
  id: number
  /** Price in Wins (pad 0 is free). Pads are bought in order and kept through rebirths. */
  cost: number
  mult: number
  /** Glow colour of the "STAND HERE" tile. */
  color: string
}

export const TRAINING_PADS: readonly TrainingPadDef[] = [
  { id: 0, cost: 0, mult: 1.25, color: '#ff4d4d' },
  { id: 1, cost: 600, mult: 1.5, color: '#2ee66b' },
  { id: 2, cost: 18_000, mult: 2, color: '#ffe23d' },
  { id: 3, cost: 400_000, mult: 4, color: '#3da5ff' },
  { id: 4, cost: 7_000_000, mult: 8, color: '#b04dff' },
  { id: 5, cost: 25_000_000, mult: 16, color: '#ff8a1f' },
  { id: 6, cost: 1_000_000_000, mult: 75, color: '#ffffff' },
]

/** `padsOwned` is PlayerData.trainingPads: pads 0..padsOwned-1 are owned. */
export function isPadOwned(padId: number, padsOwned: number): boolean {
  return padId >= 0 && padId < Math.min(padsOwned, TRAINING_PADS.length)
}

/** Highest pad the player may stand on. */
export function bestOwnedPad(padsOwned: number): number {
  return Math.max(0, Math.min(padsOwned, TRAINING_PADS.length) - 1)
}

/** Pads used to unlock at these rebirth counts; older saves keep what they had. */
const LEGACY_REBIRTH_GATES = [0, 1, 2, 4, 8, 12, 25]

export function legacyPadsOwned(rebirths: number): number {
  return LEGACY_REBIRTH_GATES.filter((r) => rebirths >= r).length
}
