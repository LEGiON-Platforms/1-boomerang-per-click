import { Color } from 'three'

import { quality } from '../../state/qualityStore'

/**
 * Pooled brick-chunk particles. Plain typed arrays, written by events and stepped
 * by <ParticleSystem>; no allocation after module load. The live count is capped
 * by the quality preset (0 on LOW = no particles).
 */
export const PARTICLE_CAPACITY = 160

export const particles = {
  pos: new Float32Array(PARTICLE_CAPACITY * 3),
  vel: new Float32Array(PARTICLE_CAPACITY * 3),
  rot: new Float32Array(PARTICLE_CAPACITY * 3),
  color: new Float32Array(PARTICLE_CAPACITY * 3),
  life: new Float32Array(PARTICLE_CAPACITY),
  maxLife: new Float32Array(PARTICLE_CAPACITY),
  size: new Float32Array(PARTICLE_CAPACITY),
  /** Ring cursor: the next slot to (re)use. */
  cursor: 0,
}

const _c = new Color()

/** Spawns `count` chunks flying out of (x, y, z). */
export function burst(
  x: number,
  y: number,
  z: number,
  color: string | number,
  count: number,
  speed = 6,
  spreadX = 1,
  size = 0.35,
): void {
  const cap = Math.min(quality().particles, PARTICLE_CAPACITY)
  if (cap <= 0) return
  _c.set(color)
  const n = Math.min(count, cap)
  for (let k = 0; k < n; k += 1) {
    const i = particles.cursor
    particles.cursor = (particles.cursor + 1) % cap
    const i3 = i * 3
    particles.pos[i3] = x + (Math.random() - 0.5) * spreadX * 2
    particles.pos[i3 + 1] = y + (Math.random() - 0.5) * 1.5
    particles.pos[i3 + 2] = z + (Math.random() - 0.5) * 0.6
    const a = Math.random() * Math.PI * 2
    const s = speed * (0.4 + Math.random() * 0.8)
    particles.vel[i3] = Math.cos(a) * s * 0.7
    particles.vel[i3 + 1] = 3 + Math.random() * speed
    particles.vel[i3 + 2] = Math.sin(a) * s * 0.7 + speed * 0.3
    particles.rot[i3] = Math.random() * 6
    particles.rot[i3 + 1] = Math.random() * 6
    particles.rot[i3 + 2] = Math.random() * 6
    // Slight per-chunk shade variation reads as different bricks.
    const shade = 0.8 + Math.random() * 0.35
    particles.color[i3] = _c.r * shade
    particles.color[i3 + 1] = _c.g * shade
    particles.color[i3 + 2] = _c.b * shade
    particles.maxLife[i] = 0.9 + Math.random() * 0.6
    particles.life[i] = particles.maxLife[i]
    particles.size[i] = size * (0.6 + Math.random() * 0.8)
  }
}

const CONFETTI = ['#ff4d4d', '#ffd21f', '#2ee66b', '#3da5ff', '#b04dff', '#ff8ad8']

export function confetti(x: number, y: number, z: number, count = 40): void {
  for (let i = 0; i < CONFETTI.length; i += 1) {
    burst(x, y, z, CONFETTI[i], Math.ceil(count / CONFETTI.length), 7, 2.5, 0.22)
  }
}
