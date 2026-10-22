import { create } from 'zustand'

/**
 * Quality presets (performance contract). Every visual feature reads its switch
 * from here before rendering; <PerformanceMonitor> drops the preset when FPS
 * sags below 45.
 */
export type Preset = 'LOW' | 'MEDIUM' | 'HIGH'
export const PRESET_ORDER: Preset[] = ['LOW', 'MEDIUM', 'HIGH']

export interface QualitySettings {
  dpr: number | [number, number]
  antialias: boolean
  shadows: boolean
  shadowMapSize: number
  /** Max live particles; 0 disables particles entirely. */
  particles: number
  playerTrails: boolean
  clouds: boolean
  /** Camera far plane and fog end. */
  viewDistance: number
  fogNear: number
  /** Max size of procedural textures (px). */
  textureSize: number
  /** Sign text resolution: texture pixels per world unit (signs are split over as many
   * textureSize² pages as they need, so this stays sharp even on LOW). */
  signPpu: number
  /** Name tags further than this are hidden. */
  nameTagDistance: number
  /** Render other players' pets. */
  remotePets: boolean
  /** Nearest other players drawn as full Bloxity avatars (~6 draw calls each), and within what distance. */
  remoteAvatars: number
  remoteAvatarDistance: number
  /**
   * Lighter HUD effects: fast taps merge into one flying "+X" every 350 ms, HUD
   * numbers refresh every 200 ms and the Power counter doesn't bump (fewer DOM
   * updates to lay out and paint).
   */
  lightHud: boolean
}

export const PRESETS: Record<Preset, QualitySettings> = {
  LOW: {
    dpr: 1,
    antialias: false,
    shadows: false,
    shadowMapSize: 512,
    particles: 0,
    playerTrails: false,
    clouds: false,
    viewDistance: 140,
    fogNear: 50,
    textureSize: 256,
    signPpu: 44,
    nameTagDistance: 25,
    remotePets: false,
    remoteAvatars: 3,
    remoteAvatarDistance: 30,
    lightHud: true,
  },
  MEDIUM: {
    dpr: [1, 1.5],
    antialias: true,
    shadows: true,
    shadowMapSize: 1024,
    particles: 80,
    playerTrails: false,
    clouds: true,
    viewDistance: 260,
    fogNear: 90,
    textureSize: 512,
    signPpu: 52,
    nameTagDistance: 45,
    remotePets: true,
    remoteAvatars: 5,
    remoteAvatarDistance: 45,
    lightHud: false,
  },
  HIGH: {
    dpr: [1, 2],
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    particles: 160,
    playerTrails: true,
    clouds: true,
    viewDistance: 420,
    fogNear: 120,
    textureSize: 512,
    signPpu: 60,
    nameTagDistance: 60,
    remotePets: true,
    remoteAvatars: 7,
    remoteAvatarDistance: 70,
    lightHud: false,
  },
}

export const isTouchDevice = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window)

/** Mobile or ≤ 4 cores → LOW; 8+ cores → HIGH; otherwise MEDIUM. */
export function detectPreset(): Preset {
  const cores = navigator.hardwareConcurrency || 4
  const mobile = isTouchDevice() || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  if (mobile || cores <= 4) return 'LOW'
  if (cores >= 8) return 'HIGH'
  return 'MEDIUM'
}

const STORAGE_KEY = 'bpc:settings'
/** Bumped when the defaults change: older saved presets are reset to the default. */
const SETTINGS_VERSION = 2

interface Persisted {
  v: number
  preset: Preset
  auto: boolean
  music: boolean
  sfx: boolean
  hideOtherPets: boolean
}

function load(): Partial<Persisted> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<Persisted>
  } catch {
    return {}
  }
}

function save(p: Persisted): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    // Private mode / blocked storage: settings just won't stick.
  }
}

interface QualityState extends Omit<Persisted, 'v'> {
  settings: QualitySettings
  /** r3f-perf overlay (dev builds only). */
  showPerf: boolean
  setPreset: (preset: Preset) => void
  setAuto: () => void
  /** Called by PerformanceMonitor: one step down, only in auto mode. */
  drop: () => void
  setMusic: (on: boolean) => void
  setSfx: (on: boolean) => void
  setHideOtherPets: (on: boolean) => void
  setShowPerf: (on: boolean) => void
}

// Graphics start on LOW (players can raise it, or pick Auto, in Settings). Saves from
// before LOW became the default don't carry their preset over.
const initial = load()
const fresh = initial.v !== SETTINGS_VERSION
const initialAuto = fresh ? false : (initial.auto ?? false)
const initialPreset: Preset = fresh ? 'LOW' : initialAuto ? detectPreset() : (initial.preset ?? 'LOW')

export const useQuality = create<QualityState>((set, get) => {
  const persist = () => {
    const s = get()
    save({ v: SETTINGS_VERSION, preset: s.preset, auto: s.auto, music: s.music, sfx: s.sfx, hideOtherPets: s.hideOtherPets })
  }
  return {
    preset: initialPreset,
    auto: initialAuto,
    settings: PRESETS[initialPreset],
    music: initial.music ?? true,
    sfx: initial.sfx ?? true,
    hideOtherPets: initial.hideOtherPets ?? false,
    showPerf: import.meta.env.DEV && new URLSearchParams(location.search).has('perf'),
    setPreset: (preset) => {
      set({ preset, auto: false, settings: PRESETS[preset] })
      persist()
    },
    setAuto: () => {
      const preset = detectPreset()
      set({ preset, auto: true, settings: PRESETS[preset] })
      persist()
    },
    drop: () => {
      const { auto, preset } = get()
      const i = PRESET_ORDER.indexOf(preset)
      if (!auto || i <= 0) return
      const next = PRESET_ORDER[i - 1]
      set({ preset: next, settings: PRESETS[next] })
      persist()
    },
    setMusic: (music) => {
      set({ music })
      persist()
    },
    setSfx: (sfx) => {
      set({ sfx })
      persist()
    },
    setHideOtherPets: (hideOtherPets) => {
      set({ hideOtherPets })
      persist()
    },
    setShowPerf: (showPerf) => set({ showPerf }),
  }
})

/** Non-reactive read for frame loops. */
export const quality = () => useQuality.getState().settings
