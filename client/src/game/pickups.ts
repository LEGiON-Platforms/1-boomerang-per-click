import {
  C2S,
  distance2D,
  HALLOWEEN,
  LUCKY_BLOCK,
  LUCKY_PHASE,
  pumpkinAvailable,
  PUMPKIN_SPOTS,
} from '@game/shared'

import { playSfx } from '../audio/sfx'
import { send } from '../net/connection'
import { game, serverNow } from '../state/gameStore'
import { spawnFloat } from '../ui/floating'
import { localPlayer } from './runtime'

/** Pumpkins we've asked the server for; hidden until it confirms or the request times out. */
export const pumpkinPending = new Map<number, number>()
let luckySentAt = 0

/** Is pumpkin `i` visible for the local player right now? */
export function pumpkinVisible(i: number, nowMs: number): boolean {
  const d = game().data
  if (!d || !HALLOWEEN.enabled) return false
  const pendingAt = pumpkinPending.get(i)
  if (pendingAt !== undefined && nowMs - pendingAt < 2000) return false
  return pumpkinAvailable(d, i, serverNow())
}

/** Walk-over collection for pumpkins and the lucky block (called at 10 Hz). */
export function tickPickups(nowMs: number): void {
  const g = game()
  const p = localPlayer.pos

  if (HALLOWEEN.enabled && g.data) {
    for (let i = 0; i < PUMPKIN_SPOTS.length; i += 1) {
      const spot = PUMPKIN_SPOTS[i]
      if (Math.abs(spot.z - p.z) > HALLOWEEN.pickupRadius || distance2D(p, spot) > HALLOWEEN.pickupRadius) continue
      if (!pumpkinVisible(i, nowMs)) continue
      pumpkinPending.set(i, nowMs)
      send(C2S.collectPumpkin, { index: i })
      playSfx('pumpkin')
      spawnFloat(`+${HALLOWEEN.pumpkinValue} Pumpkin`, '#ff9a2f', 50, 66)
    }
  }

  const lucky = g.lucky
  if (
    lucky.phase === LUCKY_PHASE.active &&
    nowMs - luckySentAt > 1000 &&
    distance2D(p, lucky) <= LUCKY_BLOCK.touchRadius
  ) {
    luckySentAt = nowMs
    send(C2S.claimLuckyBlock)
  }
}
