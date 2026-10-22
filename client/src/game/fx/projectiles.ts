import { TRAINING_PAD_SPOTS } from '@game/shared'
import { Vector3 } from 'three'

import { playSfx } from '../../audio/sfx'
import { type BoomerangLook, boomerangLook } from '../boomerangShapes'
import { remotePlayers } from '../../net/remote'
import { CATCH_ANIM_S, CATCH_AT, catchStartAt, heldBoomerang, localPlayer, now, triggerShake, wallFx } from '../runtime'
import { burst } from './particles'
import { whooshForThrow } from './whoosh'

/**
 * Pooled thrown boomerangs. A throw arcs out to its target and back to the
 * thrower's hand in THROW.flightTime. If the server's result arrives while the
 * boomerang is still outbound, its hit effect plays at the moment of impact.
 *
 * A boomerang IS the one from the thrower's hand: `t` starts below 0 while it is
 * still held during the wind-up, it leaves from wherever the hand is at release,
 * homes back to the hand on the return leg, and the thrower reaches out to catch it.
 */
export const PROJECTILE_CAPACITY = 40
export const FLIGHT_TIME = 0.6

export const IMPACT = { none: 0, wall: 1, dummy: 2 } as const

export interface Projectile {
  active: boolean
  /** Unique per launch, so renderers can tell a reused slot from the same throw. */
  id: number
  /** 'local' or a remote sessionId. */
  owner: string
  seq: number
  t: number
  from: Vector3
  to: Vector3
  /** Which boomerang it is (shared look object). */
  look: BoomerangLook
  trail: number
  /** Effect to play at impact (IMPACT value), filled in when the result arrives. */
  impact: number
  impactPlayed: boolean
  impactColor: string
  impactBroken: boolean
}

export const projectiles: Projectile[] = Array.from({ length: PROJECTILE_CAPACITY }, () => ({
  active: false,
  id: 0,
  owner: '',
  seq: 0,
  t: 0,
  from: new Vector3(),
  to: new Vector3(),
  look: boomerangLook(0),
  trail: 0,
  impact: IMPACT.none,
  impactPlayed: false,
  impactColor: '#ffffff',
  impactBroken: false,
}))

let cursor = 0
let nextId = 1

export function launch(
  owner: string,
  seq: number,
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  boomerang: number,
  vip: boolean,
  trail: number,
  /** Seconds it stays in the hand before release (the rest of the wind-up). */
  delay = 0,
): void {
  // Reuse the oldest slot if every one is in flight.
  const p = projectiles[cursor]
  cursor = (cursor + 1) % PROJECTILE_CAPACITY
  p.active = true
  p.id = nextId++
  p.owner = owner
  p.seq = seq
  p.t = -delay / FLIGHT_TIME
  p.from.set(from.x, from.y, from.z)
  p.to.set(to.x, to.y, to.z)
  p.look = boomerangLook(boomerang, vip)
  p.trail = trail
  p.impact = IMPACT.none
  p.impactPlayed = false
}

/** Clock time (s) each training dummy was last hit, for its wobble. */
export const dummyHitAt = new Float64Array(TRAINING_PAD_SPOTS.length).fill(-10)

function playImpact(kind: number, x: number, y: number, z: number, color: string, broken: boolean): void {
  if (kind === IMPACT.dummy) {
    for (let i = 0; i < TRAINING_PAD_SPOTS.length; i += 1) {
      if (Math.abs(TRAINING_PAD_SPOTS[i].dummy.z - z) < 1) dummyHitAt[i] = now()
    }
  }
  if (kind === IMPACT.wall) {
    if (broken) {
      // The wall itself shatters into chunks (corridor/wallShatter.ts); this is dust on top.
      wallFx.breakAt = now()
      wallFx.breakX = x
      burst(x, y, z, color, 16, 7, 3, 0.35)
      triggerShake(0.55)
      playSfx('break')
    } else {
      burst(x, y, z, color, 5, 4, 0.6, 0.25)
      playSfx('hit')
    }
  } else if (kind === IMPACT.dummy) {
    burst(x, y, z, '#ffd36a', 3, 3, 0.4, 0.18)
    playSfx('hit')
  }
}

/**
 * Attaches the server's verdict to the matching outbound boomerang, or plays it
 * right away if that boomerang already turned back (lag).
 */
export function resolveImpact(
  owner: string,
  seq: number,
  kind: number,
  at: { x: number; y: number; z: number },
  color: string,
  broken: boolean,
): void {
  for (let i = 0; i < projectiles.length; i += 1) {
    const p = projectiles[i]
    if (p.active && p.owner === owner && p.seq === seq && !p.impactPlayed && p.t < 0.5) {
      p.impact = kind
      p.impactColor = color
      p.impactBroken = broken
      p.to.set(at.x, at.y, at.z)
      return
    }
  }
  playImpact(kind, at.x, at.y, at.z, color, broken)
}

/** Flight left (normalised) when the thrower starts reaching out to catch it. */
const CATCH_LEAD = (CATCH_ANIM_S * CATCH_AT) / FLIGHT_TIME

/** Keeps the path's start on the thrower's hand (before release and on the way back). */
function homeToHand(p: Projectile): void {
  if (p.owner === 'local') {
    p.from.copy(heldBoomerang.position)
    return
  }
  const r = remotePlayers.get(p.owner)
  if (r?.full && now() - r.handAt < 0.2) p.from.copy(r.hand)
}

function startCatch(owner: string): void {
  const t = now()
  if (owner === 'local') {
    localPlayer.catchAt = catchStartAt(localPlayer.catchAt, t)
    return
  }
  const r = remotePlayers.get(owner)
  if (r) r.catchAt = catchStartAt(r.catchAt, t)
}

/** Advances every live boomerang; called once per frame by the renderer. */
export function stepProjectiles(dt: number): void {
  for (let i = 0; i < projectiles.length; i += 1) {
    const p = projectiles[i]
    if (!p.active) continue
    const before = p.t
    p.t += dt / FLIGHT_TIME
    if (p.t <= 0 || p.t > 0.5) homeToHand(p)
    // Released: it cuts through the air.
    if (before <= 0 && p.t > 0) whooshForThrow(p.owner, p.from.x, p.from.z)
    if (p.t >= 0.5 && !p.impactPlayed) {
      p.impactPlayed = true
      if (p.impact !== IMPACT.none) playImpact(p.impact, p.to.x, p.to.y, p.to.z, p.impactColor, p.impactBroken)
    }
    if (before < 1 - CATCH_LEAD && p.t >= 1 - CATCH_LEAD) startCatch(p.owner)
    if (p.t >= 1) p.active = false
  }
}

/** Current position of a boomerang in flight, written into `out`. */
export function projectilePosition(p: Projectile, out: Vector3): Vector3 {
  return pathPosition(p, p.t, out)
}

/**
 * Position along the out-and-back arc at normalised time t (0..1), written into
 * `out`. The return leg curves to one side so it reads as a boomerang.
 */
export function pathPosition(p: Projectile, t: number, out: Vector3): Vector3 {
  const k = t < 0.5 ? t * 2 : 2 - t * 2 // 0 → 1 → 0 along the path
  const ease = 1 - (1 - k) * (1 - k)
  out.lerpVectors(p.from, p.to, ease)
  // Sideways swing: out on the right, back on the left.
  const dx = p.to.x - p.from.x
  const dz = p.to.z - p.from.z
  const len = Math.hypot(dx, dz) || 1
  const side = Math.sin(t * Math.PI * 2) * Math.min(2.2, len * 0.18)
  out.x += (-dz / len) * side
  out.z += (dx / len) * side
  out.y += Math.sin(k * Math.PI) * 1.2
  return out
}
