import { BOOMERANGS, TRAINING_PAD_SPOTS, VIP_BOOMERANG } from '@game/shared'
import { Vector3 } from 'three'

import { playSfx } from '../../audio/sfx'
import { now, triggerShake } from '../runtime'
import { burst } from './particles'

/**
 * Pooled thrown boomerangs. A throw arcs out to its target and back to the
 * thrower's hand in THROW.flightTime. If the server's result arrives while the
 * boomerang is still outbound, its hit effect plays at the moment of impact.
 */
export const PROJECTILE_CAPACITY = 40
export const FLIGHT_TIME = 0.6

export const IMPACT = { none: 0, wall: 1, dummy: 2 } as const

export interface Projectile {
  active: boolean
  /** 'local' or a remote sessionId. */
  owner: string
  seq: number
  t: number
  from: Vector3
  to: Vector3
  /** Body colour as a number (0xRRGGBB) so frame loops never parse strings. */
  color: number
  glow: number
  trail: number
  /** Effect to play at impact (IMPACT value), filled in when the result arrives. */
  impact: number
  impactPlayed: boolean
  impactColor: string
  impactBroken: boolean
}

export const projectiles: Projectile[] = Array.from({ length: PROJECTILE_CAPACITY }, () => ({
  active: false,
  owner: '',
  seq: 0,
  t: 0,
  from: new Vector3(),
  to: new Vector3(),
  color: 0xffffff,
  glow: 0,
  trail: 0,
  impact: IMPACT.none,
  impactPlayed: false,
  impactColor: '#ffffff',
  impactBroken: false,
}))

let cursor = 0

const hex = (s: string) => parseInt(s.slice(1), 16)
const LOOKS = BOOMERANGS.map((b) => ({ color: b.color, hex: hex(b.color), glow: b.glow }))
const VIP_LOOK = { color: VIP_BOOMERANG.color, hex: hex(VIP_BOOMERANG.color), glow: VIP_BOOMERANG.glow }

/** Colour/glow of a boomerang; returns a shared object — don't mutate it. */
export function boomerangLook(id: number, vip: boolean): { color: string; hex: number; glow: number } {
  if (vip) return VIP_LOOK
  return LOOKS[Math.min(Math.max(id, 0), LOOKS.length - 1)]
}

export function launch(
  owner: string,
  seq: number,
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  boomerang: number,
  vip: boolean,
  trail: number,
): void {
  // Reuse the oldest slot if every one is in flight.
  const p = projectiles[cursor]
  cursor = (cursor + 1) % PROJECTILE_CAPACITY
  const look = boomerangLook(boomerang, vip)
  p.active = true
  p.owner = owner
  p.seq = seq
  p.t = 0
  p.from.set(from.x, from.y, from.z)
  p.to.set(to.x, to.y, to.z)
  p.color = look.hex
  p.glow = look.glow
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
      burst(x, y, z, color, 36, 8, 4, 0.5)
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

/** Advances every live boomerang; called once per frame by the renderer. */
export function stepProjectiles(dt: number): void {
  for (let i = 0; i < projectiles.length; i += 1) {
    const p = projectiles[i]
    if (!p.active) continue
    p.t += dt / FLIGHT_TIME
    if (p.t >= 0.5 && !p.impactPlayed) {
      p.impactPlayed = true
      if (p.impact !== IMPACT.none) playImpact(p.impact, p.to.x, p.to.y, p.to.z, p.impactColor, p.impactBroken)
    }
    if (p.t >= 1) p.active = false
  }
}

/**
 * Position along the out-and-back arc at normalised time t (0..1), written into
 * `out`. The return leg curves to one side so it reads as a boomerang.
 */
export function projectilePosition(p: Projectile, out: Vector3): Vector3 {
  const t = p.t
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
