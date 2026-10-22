import {
  C2S,
  clickGainFor,
  formatGain,
  formatNumber,
  isPadUnlocked,
  padAtPosition,
  stageAtZ,
  stageDef,
  TARGET,
  THROW,
  type ThrowResultMsg,
  TRAINING_PAD_SPOTS,
  WALL_THICKNESS,
  wallZ,
  WALLS_PER_STAGE,
  bestBoomerangId,
} from '@game/shared'

import { playSfx } from '../audio/sfx'
import { send } from '../net/connection'
import type { RemotePlayer } from '../net/remote'
import { game, serverNow, useGame } from '../state/gameStore'
import { quality } from '../state/qualityStore'
import { flyGain, spawnFloat } from '../ui/floating'
import { IMPACT, launch, resolveImpact } from './fx/projectiles'
import { DUMMY_STRIKE } from './lobby/Dummies'
import { localPlayer, now, playerScreenPoint, throwStartAt, wallFx } from './runtime'

/** Just under the server's 12/s cap so normal spam-clicking is never refused. */
const MIN_INTERVAL_MS = 1000 / 11

let seq = 0
let lastThrowMs = 0
/** Gain not yet shown as a flying "+X" (light HUD merges fast taps), and when the last one flew. */
let unflownGain = 0
/** Light HUD: fast taps merge into one flying "+X" this often. */
const LIGHT_FLY_MS = 350
let lastFlyMs = 0

/** Where the local player's next throw will land (scratch object). */
const target = { x: 0, y: 0, z: 0, kind: TARGET.none as number, pad: -1 }

/** Works out what a throw from the current position would hit. */
export function computeTarget(): typeof target {
  const g = game()
  const p = localPlayer.pos
  const pad = padAtPosition(p)
  if (pad >= 0 && g.data && isPadUnlocked(pad, g.data.rebirths)) {
    const dummy = TRAINING_PAD_SPOTS[pad].dummy
    target.kind = TARGET.dummy
    target.pad = pad
    target.x = dummy.x + DUMMY_STRIKE.dx
    target.y = DUMMY_STRIKE.y
    target.z = dummy.z
    return target
  }
  target.pad = -1
  const run = g.run
  if (stageAtZ(p.z) === run.stage && run.wallsBroken < WALLS_PER_STAGE) {
    const wz = wallZ(run.stage, run.wallsBroken + 1)
    const distance = p.z - wz
    if (distance >= -1 && distance <= THROW.range) {
      target.kind = TARGET.wall
      target.x = Math.max(-6, Math.min(6, p.x))
      target.y = 2.6
      target.z = wz + WALL_THICKNESS / 2
      return target
    }
  }
  target.kind = TARGET.none
  target.x = p.x + Math.sin(localPlayer.rotY) * 11
  target.y = 1.6
  target.z = p.z + Math.cos(localPlayer.rotY) * 11
  return target
}

function friendsInRoom(): number {
  const g = game()
  if (!g.data || g.data.friends.length === 0) return 0
  let n = 0
  for (const p of g.roomPlayers) if (!p.isLocal && g.data.friends.includes(p.pid)) n += 1
  return n
}

/** Hand position of a player standing at (x, z) facing `rotY`. */
function handOf(x: number, y: number, z: number, rotY: number) {
  return {
    x: x + Math.cos(rotY) * -0.55 + Math.sin(rotY) * 0.4,
    y: y + 2.1, // released above the shoulder
    z: z - Math.sin(rotY) * -0.55 + Math.cos(rotY) * 0.4,
  }
}

/** Throws one boomerang. Returns false when rate-limited or not connected. */
export function requestThrow(from?: { x: number; y: number }): boolean {
  const g = game()
  if (g.status !== 'connected' || !g.data) return false
  const ms = performance.now()
  if (ms - lastThrowMs < MIN_INTERVAL_MS) return false
  lastThrowMs = ms
  seq = (seq + 1) % 1_000_000

  const t = computeTarget()
  const gain = clickGainFor(g.data, { padId: t.pad, friendsInRoom: friendsInRoom(), now: serverNow() })
  useGame.getState().setPowerWins(g.power + gain)
  unflownGain += gain
  const light = quality().lightHud
  if (!light || ms - lastFlyMs >= LIGHT_FLY_MS) {
    flyGain(from ?? playerScreenPoint(1.6), `+${formatGain(unflownGain)}`, !light)
    unflownGain = 0
    lastFlyMs = ms
  }

  const lp = localPlayer
  lp.throwAt = throwStartAt(lp.throwAt, now())
  if (t.kind !== TARGET.none) {
    lp.aimYaw = Math.atan2(t.x - lp.pos.x, t.z - lp.pos.z)
    lp.aimUntil = now() + 0.5
  }
  launch(
    'local',
    seq,
    handOf(lp.pos.x, lp.pos.y, lp.pos.z, lp.rotY),
    t,
    bestBoomerangId(g.data),
    g.data.vipBoomerang,
    g.data.equippedTrail,
  )
  playSfx('throw')
  send(C2S.throw, { s: seq })
  return true
}

/** Authoritative result for one of our throws. */
export function onThrowResult(m: ThrowResultMsg): void {
  const store = useGame.getState()
  store.setPowerWins(m.p, m.w)
  store.addXp(m.g)
  if (m.run) store.setRun(m.run)

  if (m.t === TARGET.wall && m.hit) {
    const stage = (m.run ?? store.run).stage
    const color = stageDef(stage).color
    const at = { x: Math.max(-6, Math.min(6, localPlayer.pos.x)), y: 2.6, z: wallZ(stage, m.hit.wall) + WALL_THICKNESS / 2 }
    resolveImpact('local', m.s, IMPACT.wall, at, color, m.hit.broken)
    if (!m.hit.broken) wallFx.hitAt = now()
    if (m.hit.winsGained > 0) spawnFloat(`+${formatNumber(m.hit.winsGained)} Wins`, '#ffe14a', 50, 62, true)
  } else if (m.t === TARGET.dummy && m.pad !== undefined) {
    const dummy = TRAINING_PAD_SPOTS[m.pad].dummy
    resolveImpact('local', m.s, IMPACT.dummy, { x: dummy.x + DUMMY_STRIKE.dx, y: DUMMY_STRIKE.y, z: dummy.z }, '#ffd36a', false)
  }
}

/** Another player threw: animate them and send a boomerang along their facing. */
export function onRemoteThrow(p: RemotePlayer): void {
  p.throwAt = throwStartAt(p.throwAt, now())
  const from = handOf(p.px, p.py, p.pz, p.prot)
  // On a training pad their throws hit that pad's dummy, like ours; otherwise straight ahead.
  const pad = padAtPosition({ x: p.px, z: p.pz })
  const dummy = pad >= 0 ? TRAINING_PAD_SPOTS[pad].dummy : null
  const to = dummy
    ? { x: dummy.x + DUMMY_STRIKE.dx, y: DUMMY_STRIKE.y, z: dummy.z }
    : { x: p.px + Math.sin(p.prot) * 10, y: 1.8, z: p.pz + Math.cos(p.prot) * 10 }
  launch(p.sessionId, 0, from, to, p.boomerang, p.vip, p.trail)
}
