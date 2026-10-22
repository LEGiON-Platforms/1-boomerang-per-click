/** Training pads in the lobby. Standing on one multiplies click gain. */

export interface TrainingPadDef {
  id: number
  /** Header label: "FREE" or the rebirth requirement. */
  label: string
  requiredRebirths: number
  mult: number
  /** Glow colour of the "STAND HERE" tile. */
  color: string
}

export const TRAINING_PADS: readonly TrainingPadDef[] = [
  { id: 0, label: 'FREE', requiredRebirths: 0, mult: 1.25, color: '#ff4d4d' },
  { id: 1, label: '1', requiredRebirths: 1, mult: 1.5, color: '#2ee66b' },
  { id: 2, label: '2', requiredRebirths: 2, mult: 2, color: '#ffe23d' },
  { id: 3, label: '4', requiredRebirths: 4, mult: 4, color: '#3da5ff' },
  { id: 4, label: '8', requiredRebirths: 8, mult: 8, color: '#b04dff' },
  { id: 5, label: '12', requiredRebirths: 12, mult: 16, color: '#ff8a1f' },
  { id: 6, label: '25', requiredRebirths: 25, mult: 75, color: '#ffffff' },
]

export function isPadUnlocked(padId: number, rebirths: number): boolean {
  const pad = TRAINING_PADS[padId]
  return Boolean(pad) && rebirths >= pad.requiredRebirths
}

/** Highest pad the player may stand on. */
export function bestUnlockedPad(rebirths: number): number {
  let best = 0
  for (const pad of TRAINING_PADS) if (rebirths >= pad.requiredRebirths) best = pad.id
  return best
}
