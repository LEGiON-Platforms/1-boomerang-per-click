/** Random number helpers. The server passes Math.random; tools pass a seeded PRNG. */

export type Rng = () => number

/** Small, fast, seedable PRNG (period 2^32). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a string hash → 32-bit unsigned int. */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Index into `weights`, chosen proportionally. Zero/negative weights never win. */
export function weightedIndex(weights: readonly number[], rng: Rng): number {
  let total = 0
  for (const w of weights) total += Math.max(0, w)
  let roll = rng() * total
  for (let i = 0; i < weights.length; i += 1) {
    const w = Math.max(0, weights[i])
    if (roll < w) return i
    roll -= w
  }
  // Float rounding at the very top of the range: return the last non-zero weight.
  for (let i = weights.length - 1; i >= 0; i -= 1) if (weights[i] > 0) return i
  return 0
}

/** `count` distinct items, deterministic for a given rng. */
export function pickDistinct<T>(items: readonly T[], count: number, rng: Rng): T[] {
  const pool = items.slice()
  const out: T[] = []
  while (out.length < count && pool.length) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0])
  }
  return out
}
