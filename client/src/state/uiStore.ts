import type {
  EggResultMsg,
  OfflineMsg,
  PadClaimedMsg,
  RewardMsg,
} from '@game/shared'
import { create } from 'zustand'

export type PanelId =
  | 'trails'
  | 'shop'
  | 'items'
  | 'rebirth'
  | 'stages'
  | 'gifts'
  | 'daily'
  | 'quests'
  | 'codes'
  | 'friends'
  | 'settings'
  | 'egg'

export type ToastKind = 'info' | 'success' | 'error' | 'badge'

export interface Toast {
  id: number
  kind: ToastKind
  title: string
  text?: string
}

interface UIState {
  panel: PanelId | null
  /** Panel argument (the egg index for the egg panel). */
  panelArg: number
  toasts: Toast[]
  eggQueue: EggResultMsg[]
  rewardQueue: RewardMsg[]
  stageClear: PadClaimedMsg | null
  tutorialRoll: number | null
  offline: OfflineMsg | null
  /** Shown once on first visit before joining. */
  needsName: boolean
  /** Yes/no dialog (gem purchases, deleting pets). */
  confirm: { title: string; text: string; yes: string; onYes: () => void } | null

  openPanel: (panel: PanelId, arg?: number) => void
  togglePanel: (panel: PanelId, arg?: number) => void
  closePanel: () => void
  toast: (title: string, kind?: ToastKind, text?: string) => void
  dismissToast: (id: number) => void
  pushEgg: (r: EggResultMsg) => void
  shiftEgg: () => void
  pushReward: (r: RewardMsg) => void
  shiftReward: () => void
  ask: (title: string, text: string, yes: string, onYes: () => void) => void
  set: (partial: Partial<UIState>) => void
}

let toastId = 1
const TOAST_MS = 3200
const MAX_TOASTS = 4

export const useUI = create<UIState>((set, get) => ({
  panel: null,
  panelArg: 0,
  toasts: [],
  eggQueue: [],
  rewardQueue: [],
  stageClear: null,
  tutorialRoll: null,
  offline: null,
  needsName: false,
  confirm: null,

  openPanel: (panel, arg = 0) => set({ panel, panelArg: arg }),
  togglePanel: (panel, arg = 0) =>
    set(get().panel === panel && get().panelArg === arg ? { panel: null } : { panel, panelArg: arg }),
  closePanel: () => set({ panel: null }),
  toast: (title, kind = 'info', text) => {
    const id = toastId++
    set({ toasts: [...get().toasts.slice(-(MAX_TOASTS - 1)), { id, kind, title, text }] })
    setTimeout(() => get().dismissToast(id), kind === 'badge' ? 4500 : TOAST_MS)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  pushEgg: (r) => set({ eggQueue: [...get().eggQueue, r] }),
  shiftEgg: () => set({ eggQueue: get().eggQueue.slice(1) }),
  pushReward: (r) => set({ rewardQueue: [...get().rewardQueue, r] }),
  shiftReward: () => set({ rewardQueue: get().rewardQueue.slice(1) }),
  ask: (title, text, yes, onYes) => set({ confirm: { title, text, yes, onYes } }),
  set: (partial) => set(partial),
}))

export const ui = () => useUI.getState()
