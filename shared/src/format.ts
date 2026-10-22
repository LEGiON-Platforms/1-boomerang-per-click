/** Number and time formatting shared by HUD, 3D labels and server messages. */

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc']

/**
 * 999 → "999", 1234 → "1.2K", 3_400_000 → "3.4M", 1.2e15 → "1.2Qa".
 * Values under 1000 are floored; above, one decimal is kept (and ".0" dropped).
 */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '∞'
  const sign = value < 0 ? '-' : ''
  let n = Math.abs(value)
  if (n < 1000) return sign + String(Math.floor(n))

  let tier = 0
  while (n >= 1000 && tier < SUFFIXES.length - 1) {
    n /= 1000
    tier += 1
  }
  // Rounding can carry into the next tier: 999.96K must read 1M, not "1000K".
  let rounded = Math.floor(n * 10) / 10
  if (rounded >= 1000 && tier < SUFFIXES.length - 1) {
    rounded /= 1000
    tier += 1
  }
  const text = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)
  return sign + text + SUFFIXES[tier]
}

/** Thousands separators, for exact counts in UI copy: 25000 → "25,000". */
export function formatInt(value: number): string {
  return Math.floor(value).toLocaleString('en-US')
}

/** 82 → "1m 22s", 55 → "55s", 3720 → "1h 2m". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

/** 579 → "9:39" — the boost timer style. */
export function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const ss = String(s % 60).padStart(2, '0')
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${ss}`
  return `${m}:${ss}`
}

/** 516.31 → "08:36.31" — the limited-offer countdown style. */
export function formatOfferClock(seconds: number): string {
  const t = Math.max(0, seconds)
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const cs = Math.floor((t * 100) % 100)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}
