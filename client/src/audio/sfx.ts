import { useQuality } from '../state/qualityStore'

/**
 * Procedural sound: every effect and the music loop are synthesised with
 * WebAudio, so audio costs zero bytes of assets. The AudioContext is created on
 * the first tap/key press (browsers block autoplay before that).
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let sfxBus: GainNode | null = null
let musicBus: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null

export type Sfx =
  | 'throw'
  | 'hit'
  | 'break'
  | 'win'
  | 'buy'
  | 'error'
  | 'click'
  | 'egg'
  | 'reveal'
  | 'levelup'
  | 'lucky'
  | 'pumpkin'
  | 'rebirth'
  | 'badge'

export function audioUnlocked(): boolean {
  return ctx !== null
}

/** Call from a user gesture. Safe to call repeatedly. */
export function unlockAudio(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume()
    return
  }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.7
  master.connect(ctx.destination)
  sfxBus = ctx.createGain()
  sfxBus.connect(master)
  musicBus = ctx.createGain()
  musicBus.gain.value = 0.22
  musicBus.connect(master)

  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const ch = noiseBuffer.getChannelData(0)
  for (let i = 0; i < ch.length; i += 1) ch[i] = Math.random() * 2 - 1

  if (useQuality.getState().music) startMusic()
}

function tone(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  endFreq?: number,
  bus: GainNode | null = sfxBus,
): void {
  if (!ctx || !bus) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + dur)
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(gain, start + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(g).connect(bus)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

function noise(start: number, dur: number, gain: number, filter: BiquadFilterType, f0: number, f1?: number): void {
  if (!ctx || !sfxBus || !noiseBuffer) return
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer
  const bq = ctx.createBiquadFilter()
  bq.type = filter
  bq.frequency.setValueAtTime(f0, start)
  if (f1) bq.frequency.exponentialRampToValueAtTime(f1, start + dur)
  bq.Q.value = 1.2
  const g = ctx.createGain()
  g.gain.setValueAtTime(gain, start)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  src.connect(bq).connect(g).connect(sfxBus)
  src.start(start, Math.random() * 0.5)
  src.stop(start + dur + 0.02)
}

/** Limits identical sounds to this many per second so spam-clicking stays pleasant. */
const lastPlayed: Partial<Record<Sfx, number>> = {}
const MIN_GAP: Partial<Record<Sfx, number>> = { throw: 0.06, hit: 0.05, pumpkin: 0.08 }

export function playSfx(name: Sfx): void {
  if (!ctx || !useQuality.getState().sfx) return
  const t = ctx.currentTime
  const gap = MIN_GAP[name] ?? 0
  if (gap && t - (lastPlayed[name] ?? -1) < gap) return
  lastPlayed[name] = t

  switch (name) {
    case 'throw':
      noise(t, 0.14, 0.35, 'bandpass', 700, 2600)
      break
    case 'hit':
      tone(170, t, 0.12, 'sine', 0.5, 55)
      noise(t, 0.05, 0.25, 'highpass', 2000)
      break
    case 'break':
      noise(t, 0.4, 0.6, 'lowpass', 2400, 200)
      tone(110, t, 0.25, 'square', 0.18, 40)
      for (let i = 0; i < 4; i += 1) tone(220 + Math.random() * 200, t + 0.03 * i, 0.08, 'triangle', 0.12, 90)
      break
    case 'win':
      ;[523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.07, 0.18, 'triangle', 0.3))
      tone(1568, t + 0.3, 0.35, 'sine', 0.18)
      break
    case 'buy':
      tone(988, t, 0.08, 'square', 0.15)
      tone(1319, t + 0.07, 0.22, 'square', 0.15)
      break
    case 'error':
      tone(150, t, 0.16, 'square', 0.12, 110)
      break
    case 'click':
      tone(1200, t, 0.035, 'sine', 0.12)
      break
    case 'egg':
      tone(200, t, 0.5, 'sawtooth', 0.08, 900)
      noise(t + 0.45, 0.3, 0.5, 'bandpass', 1200, 300)
      break
    case 'reveal':
      ;[784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.06, 0.25, 'triangle', 0.22))
      break
    case 'levelup':
      ;[523, 659, 784].forEach((f, i) => tone(f, t + i * 0.09, 0.16, 'square', 0.14))
      tone(1047, t + 0.27, 0.5, 'square', 0.16)
      break
    case 'lucky':
      for (let i = 0; i < 4; i += 1) tone(i % 2 ? 880 : 1175, t + i * 0.12, 0.11, 'square', 0.12)
      break
    case 'pumpkin':
      tone(660, t, 0.12, 'triangle', 0.25, 990)
      break
    case 'rebirth':
      tone(120, t, 1.1, 'sawtooth', 0.12, 960)
      ;[523, 659, 784, 1047].forEach((f) => tone(f, t + 0.9, 0.8, 'triangle', 0.12))
      break
    case 'badge':
      ;[659, 880, 1319].forEach((f, i) => tone(f, t + i * 0.1, 0.3, 'sine', 0.22))
      break
  }
}

/* ---------------------------------------------------------------------------
 * Music: a 4-chord loop with bass and a soft arpeggio, scheduled just ahead.
 * ------------------------------------------------------------------------- */

const BPM = 112
const STEP = 60 / BPM / 2
/** C – Am – F – G, as MIDI roots. */
const CHORDS = [
  [48, 60, 64, 67],
  [45, 60, 64, 69],
  [41, 60, 65, 69],
  [43, 59, 62, 67],
]
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

let musicTimer: number | null = null
let nextStepTime = 0
let step = 0

function scheduleMusic(): void {
  if (!ctx || !musicBus) return
  while (nextStepTime < ctx.currentTime + 0.25) {
    const chord = CHORDS[Math.floor(step / 8) % CHORDS.length]
    const s = step % 8
    if (s === 0 || s === 4) tone(midi(chord[0]), nextStepTime, STEP * 3, 'triangle', 0.35, undefined, musicBus)
    const arp = chord[1 + (s % 3)] + (s >= 4 ? 12 : 0)
    tone(midi(arp), nextStepTime, STEP * 0.9, 'square', 0.05, undefined, musicBus)
    nextStepTime += STEP
    step += 1
  }
}

export function startMusic(): void {
  if (!ctx || musicTimer !== null) return
  nextStepTime = ctx.currentTime + 0.1
  musicTimer = window.setInterval(scheduleMusic, 100)
}

export function stopMusic(): void {
  if (musicTimer !== null) window.clearInterval(musicTimer)
  musicTimer = null
}

useQuality.subscribe((s, prev) => {
  if (s.music !== prev.music) {
    if (s.music) startMusic()
    else stopMusic()
  }
})
