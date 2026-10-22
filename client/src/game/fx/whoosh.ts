import { playWhoosh } from '../../audio/sfx'
import { localPlayer } from '../runtime'

/** Other players' throws are heard up to this far away (m). */
const HEAR_DIST = 25

/**
 * The whoosh for a boomerang leaving the hand: full volume for the local player's
 * throws, quieter with distance for everyone else's (silent past HEAR_DIST).
 */
export function whooshForThrow(owner: string, x: number, z: number): void {
  if (owner === 'local') {
    playWhoosh(1)
    return
  }
  const d = Math.hypot(x - localPlayer.pos.x, z - localPlayer.pos.z)
  if (d < HEAR_DIST) playWhoosh(0.35 * (1 - d / HEAR_DIST))
}
