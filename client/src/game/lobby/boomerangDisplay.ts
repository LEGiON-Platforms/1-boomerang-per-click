import { BOOMERANG_SPOTS, BOOMERANGS } from '@game/shared'

/**
 * First boomerang shown on the Boomerang Stage: one per pad, in order. With more
 * boomerangs than pads, the page turns once every boomerang on it is owned.
 */
export function displayStart(owned: number): number {
  const pads = BOOMERANG_SPOTS.length
  const next = Math.min(owned, BOOMERANGS.length - 1)
  return Math.max(0, Math.min(Math.floor(next / pads) * pads, BOOMERANGS.length - pads))
}
