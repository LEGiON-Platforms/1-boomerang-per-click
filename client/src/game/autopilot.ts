import { C2S, PAD_X, padZ, stageAtZ, wallZ, WALLS_PER_STAGE } from '@game/shared'

import { send } from '../net/connection'
import { game, useGame } from '../state/gameStore'
import { autopilot, localPlayer } from './runtime'

let lastTeleportAt = 0

/**
 * Auto Win: plays the current stage on its own — up to each wall (auto-throw does
 * the breaking), onto the win pad, then (after the lobby respawn) on to the next
 * stage — until switched off.
 * Called by the 10 Hz logic tick.
 */
export function tickAutopilot(): void {
  const g = game()
  const d = g.data
  if (!g.autoWin || !d?.perks.autoWin) {
    autopilot.active = false
    if (g.autoWin && d && !d.perks.autoWin) useGame.getState().set({ autoWin: false })
    return
  }
  const run = g.run
  const p = localPlayer.pos
  const nowMs = performance.now()

  // Get into the active stage first.
  if (stageAtZ(p.z) !== run.stage) {
    autopilot.active = false
    if (nowMs - lastTeleportAt > 3000) {
      lastTeleportAt = nowMs
      send(C2S.teleportStage, { stage: run.stage })
    }
    return
  }

  autopilot.active = true
  autopilot.x = 0
  if (run.wallsBroken < WALLS_PER_STAGE) {
    // Stand a few units in front of the next wall: well inside throw range.
    autopilot.z = wallZ(run.stage, run.wallsBroken + 1) + 5
  } else if (!run.padClaimed) {
    autopilot.x = PAD_X
    autopilot.z = padZ(run.stage)
  } else {
    autopilot.active = false // waiting for the respawn
  }
}
