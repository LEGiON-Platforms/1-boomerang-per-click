import { C2S, padZ, stageAtZ, wallZ, WALLS_PER_STAGE } from '@game/shared'

import { send } from '../net/connection'
import { game, useGame } from '../state/gameStore'
import { autopilot, localPlayer } from './runtime'

let lastTeleportAt = 0
let farmSentForRun = ''

/**
 * Auto Win: walks the current stage on its own — up to each wall (auto-throw does
 * the breaking), onto the win pad, then "Farm Again" — until switched off.
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
    autopilot.z = padZ(run.stage)
  } else {
    autopilot.active = false
    const key = `${run.stage}:${d.stats.padsClaimed}`
    if (farmSentForRun !== key) {
      farmSentForRun = key
      send(C2S.stageChoice, { choice: 'farm' })
    }
  }
}
