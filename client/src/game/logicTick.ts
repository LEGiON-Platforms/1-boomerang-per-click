import {
  autoThrowUnlocked,
  C2S,
  distance2D,
  EGG_SPOTS,
  INTERACT_RADIUS,
  MOVE_RATE_HZ,
  onWinPad,
  padAtPosition,
  PEDESTAL_SPOTS,
  REBIRTH_STATUE,
  stageAtZ,
  STAGES_PORTAL,
  THROW,
  TRAILS_STALL,
  WALLS_PER_STAGE,
} from '@game/shared'

import { send } from '../net/connection'
import { remoteList } from '../net/remote'
import { game, type InteractTarget, useGame } from '../state/gameStore'
import { quality } from '../state/qualityStore'
import { tickAutopilot } from './autopilot'
import { tickPickups } from './pickups'
import { localPlayer } from './runtime'
import { requestThrow } from './throwing'

/**
 * Game logic at 10 Hz, outside the render loop. This is the only place that turns
 * per-frame runtime state into store updates — and only when a value changes —
 * so no store write ever happens inside a useFrame.
 */

const last = { x: NaN, z: NaN, r: NaN, a: -1, y: NaN, sentAt: 0 }
let claimSentAt = 0
let lastTags = ''

function sendMove(nowMs: number): void {
  const lp = localPlayer
  const changed =
    Math.abs(lp.pos.x - last.x) > 0.02 ||
    Math.abs(lp.pos.z - last.z) > 0.02 ||
    Math.abs(lp.pos.y - last.y) > 0.05 ||
    Math.abs(lp.rotY - last.r) > 0.03 ||
    lp.anim !== last.a
  // Heartbeat once a second so the server's position never goes stale.
  if (!changed && nowMs - last.sentAt < 1000) return
  last.x = lp.pos.x
  last.z = lp.pos.z
  last.y = lp.pos.y
  last.r = lp.rotY
  last.a = lp.anim
  last.sentAt = nowMs
  send(C2S.move, { x: lp.pos.x, y: lp.pos.y, z: lp.pos.z, r: lp.rotY, a: lp.anim })
}

function findInteract(): InteractTarget | null {
  const p = localPlayer.pos
  let best: InteractTarget | null = null
  let bestD = INTERACT_RADIUS
  const consider = (kind: InteractTarget['kind'], index: number, spot: { x: number; z: number }, radius = INTERACT_RADIUS) => {
    const d = distance2D(p, spot)
    if (d < radius && d < bestD) {
      bestD = d
      best = { kind, index }
    }
  }
  if (p.z < 0) return null
  consider('trails', 0, { x: TRAILS_STALL.x, z: TRAILS_STALL.z + 2 })
  consider('rebirth', 0, REBIRTH_STATUE, INTERACT_RADIUS + 1)
  consider('stages', 0, STAGES_PORTAL, INTERACT_RADIUS + 0.5)
  EGG_SPOTS.forEach((s, i) => consider('egg', i, s, INTERACT_RADIUS + 0.5))
  PEDESTAL_SPOTS.forEach((s, i) => consider('pedestal', i, s, 2.6))
  return best
}

const sameTarget = (a: InteractTarget | null, b: InteractTarget | null) =>
  a === b || (a !== null && b !== null && a.kind === b.kind && a.index === b.index)

function tick(): void {
  const g = game()
  if (g.status !== 'connected' || !g.data) return
  const nowMs = performance.now()
  const p = localPlayer.pos

  sendMove(nowMs)

  // HUD-facing derived state, written only on change.
  const stageHere = stageAtZ(p.z)
  const onPad = padAtPosition(p)
  const nearInteract = findInteract()
  const patch: Partial<ReturnType<typeof game>> = {}
  if (stageHere !== g.stageHere) patch.stageHere = stageHere
  if (onPad !== g.onPad) patch.onPad = onPad
  if (!sameTarget(nearInteract, g.nearInteract)) patch.nearInteract = nearInteract

  const maxTag = quality().nameTagDistance
  const tags = remoteList
    .filter((r) => Math.hypot(r.px - p.x, r.pz - p.z) < maxTag)
    .map((r) => r.sessionId)
    .sort()
  const tagKey = tags.join(',')
  if (tagKey !== lastTags) {
    lastTags = tagKey
    patch.nearbyTags = tags
  }
  if (Object.keys(patch).length) useGame.getState().set(patch)

  // Step onto the win pad → claim it (retry after a second if no answer).
  const run = g.run
  if (
    run.wallsBroken >= WALLS_PER_STAGE &&
    !run.padClaimed &&
    onWinPad(p, run.stage) &&
    nowMs - claimSentAt > 1000
  ) {
    claimSentAt = nowMs
    send(C2S.claimPad)
  }

  tickPickups(nowMs)
  tickAutopilot()
}

let autoTimer: number | null = null
let logicTimer: number | null = null

/** Starts the logic tick and the auto-throw clock. Returns a stop function. */
export function startLogic(): () => void {
  logicTimer = window.setInterval(tick, 1000 / MOVE_RATE_HZ)
  autoTimer = window.setInterval(() => {
    const g = game()
    if ((g.autoThrow || g.autoWin) && g.data && (autoThrowUnlocked(g.data) || g.autoWin)) requestThrow()
  }, 1000 / THROW.autoPerSecond)
  return () => {
    if (logicTimer !== null) window.clearInterval(logicTimer)
    if (autoTimer !== null) window.clearInterval(autoTimer)
  }
}
