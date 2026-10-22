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
  boomerangTrails: boolean
  playerTrails: boolean
  clouds: boolean
  /** Camera far plane and fog end. */
  viewDistance: number
  fogNear: number
  /** Max size of procedural textures (px). */
  textureSize: number
  /** Sign atlas resolution: texture pixels per world unit. */
  signPpu: number
  /** Name tags further than this are hidden. */
  nameTagDistance: number
  /** Render other players' pets. */
  remotePets: boolean
  /** Stages rendered on each side of the current one. */
  stageWindow: number
}

export const PRESETS: Record<Preset, QualitySettings> = {
  LOW: {
    dpr: 1,
    antialias: false,
    shadows: false,
    shadowMapSize: 512,
    particles: 0,
    boomerangTrails: false,
    playerTrails: false,
    clouds: false,
    viewDistance: 140,
    fogNear: 50,
    textureSize: 256,
    signPpu: 16,
    nameTagDistance: 25,
    remotePets: false,
    stageWindow: 0,
  },
  MEDIUM: {
    dpr: [1, 1.5],
    antialias: true,
    shadows: true,
    shadowMapSize: 1024,
    particles: 80,
    boomerangTrails: true,
    playerTrails: false,
    clouds: true,
    viewDistance: 260,
    fogNear: 90,
    textureSize: 512,
    signPpu: 28,
    nameTagDistance: 45,
    remotePets: true,
    stageWindow: 1,
  },
  HIGH: {
    dpr: [1, 2],
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    particles: 160,
    boomerangTrails: true,
    playerTrails: true,
    clouds: true,
    viewDistance: 420,
    fogNear: 120,
    textureSize: 512,
    signPpu: 32,
    nameTagDistance: 60,
    remotePets: true,
    stageWindow: 1,
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

interface Persisted {
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

interface QualityState extends Persisted {
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

const initial = load()
const initialAuto = initial.auto ?? true
const initialPreset: Preset = initialAuto ? detectPreset() : (initial.preset ?? detectPreset())

export const useQuality = create<QualityState>((set, get) => {
  const persist = () => {
    const s = get()
    save({ preset: s.preset, auto: s.auto, music: s.music, sfx: s.sfx, hideOtherPets: s.hideOtherPets })
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
