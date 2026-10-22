import { C2S, formatNumber, isPadOwned, TRAINING_PADS } from '@game/shared'

import { send } from '../net/connection'
import { game } from '../state/gameStore'
import { ui } from '../state/uiStore'

/**
 * Buys training pad `padId` with Wins if it is the next one and affordable (the
 * server checks again), else explains why not. With `teleport`, the player is also
 * moved onto the pad — right away if it is already owned.
 */
export function tryBuyPad(padId: number, teleport: boolean): void {
  const g = game()
  if (!g.data) return
  const owned = g.data.trainingPads
  const pad = TRAINING_PADS[padId]
  if (!pad) return
  if (isPadOwned(padId, owned)) {
    if (teleport) send(C2S.teleportPad, { pad: padId })
    return
  }
  if (padId > owned) {
    ui().toast(`Buy the x${TRAINING_PADS[owned].mult} pad first!`, 'error')
  } else if (g.wins < pad.cost) {
    ui().toast(`Need ${formatNumber(pad.cost - Math.floor(g.wins))} more Wins`, 'error')
  } else {
    send(C2S.buyPad)
    // Messages are handled in order, so this lands after the purchase.
    if (teleport) send(C2S.teleportPad, { pad: padId })
  }
}
