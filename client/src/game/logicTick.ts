import {
  autoThrowUnlocked,
  BOOMERANG_SPOTS,
  BOOMERANGS,
  C2S,
  distance2D,
  EGG_SPOTS,
  formatNumber,
  INTERACT_RADIUS,
  isPadUnlocked,
  levelForXp,
  levelSpeedMult,
  MOVE_RATE_HZ,
  onWinPad,
  padAtPosition,
  REBIRTH_STATUE,
  boomerangPadAt,
  stageAtZ,
  THROW,
  TRAILS_STALL,
  WALLS_PER_STAGE,
} from '@game/shared'

import { send } from '../net/connection'
import { remoteList } from '../net/remote'
import { game, type InteractTarget, useGame } from '../state/gameStore'
import { quality } from '../state/qualityStore'
import { ui } from '../state/uiStore'
import { tickAutopilot } from './autopilot'
import { displayStart } from './lobby/boomerangDisplay'
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
/** Lobby → corridor crossings warp straight to the current stage (see tick). */
let wasInLobby = true
let gateWarpAt = 0
/** Display pad stood on at the last tick (-1 = none): buying triggers on stepping onto one. */
let lastDisplayPad = -1
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
  EGG_SPOTS.forEach((s, i) => consider('egg', i, s, INTERACT_RADIUS + 0.5))
  BOOMERANG_SPOTS.forEach((s, i) => consider('pedestal', i, s, 1.8))
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
  localPlayer.speedMult = levelSpeedMult(levelForXp(g.xp))

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

  const displayPad = boomerangPadAt(p)
  if (displayPad !== lastDisplayPad) {
    lastDisplayPad = displayPad
    if (displayPad >= 0) onDisplayPad(displayPad)
  }

  // Walking through the lobby gate takes you straight to your current stage
  // (if it's untouched — a half-broken run is walked back to as it is).
  const inLobby = p.z >= 0
  if (wasInLobby && !inLobby && run.stage > 1 && run.wallsBroken === 0 && nowMs - gateWarpAt > 2000) {
    gateWarpAt = nowMs
    send(C2S.teleportStage, { stage: run.stage })
  }
  wasInLobby = inLobby

  tickPickups(nowMs)
  tickAutopilot()
}

/** Stepped onto a Boomerang Stage pad: buy that boomerang if it's the next one and affordable. */
function onDisplayPad(index: number): void {
  const g = game()
  if (!g.data) return
  const owned = g.data.boomerangsOwned
  const b = BOOMERANGS[displayStart(owned) + index]
  if (!b || b.id < owned) return
  if (b.id > owned) {
    ui().toast(`Buy the ${BOOMERANGS[owned].name} Boomerang first!`, 'error')
  } else if (g.wins < b.cost) {
    ui().toast(`Need ${formatNumber(b.cost - Math.floor(g.wins))} more Wins for ${b.name}`, 'error')
  } else {
    send(C2S.buyBoomerang)
  }
}

let autoTimer: number | null = null
let logicTimer: number | null = null

/** Starts the logic tick and the auto-throw clock. Returns a stop function. */
export function startLogic(): () => void {
  logicTimer = window.setInterval(tick, 1000 / MOVE_RATE_HZ)
  autoTimer = window.setInterval(() => {
    const g = game()
    if (!g.data) return
    // Standing on an unlocked training pad trains by itself (clicking adds more).
    const pad = padAtPosition(localPlayer.pos)
    const training = pad >= 0 && isPadUnlocked(pad, g.data.rebirths)
    if (training || ((g.autoThrow || g.autoWin) && (autoThrowUnlocked(g.data) || g.autoWin))) requestThrow()
  }, 1000 / THROW.autoPerSecond)
  return () => {
    if (logicTimer !== null) window.clearInterval(logicTimer)
    if (autoTimer !== null) window.clearInterval(autoTimer)
  }
}
