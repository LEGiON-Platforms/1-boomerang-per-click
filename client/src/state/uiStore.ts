import type {
  EggResultMsg,
  OfflineMsg,
  PadClaimedMsg,
  RewardMsg,
} from '@game/shared'
import { create } from 'zustand'

import { spawnMessage } from '../ui/floating'

export type PanelId =
  | 'trails'
  | 'shop'
  | 'items'
  | 'boosts'
  | 'rebirth'
  | 'stages'
  | 'gifts'
  | 'daily'
  | 'quests'
  | 'codes'
  | 'friends'
  | 'settings'
  | 'egg'

/** Tabs of the Shop window: one window, one panel id per tab. */
export const SHOP_TABS = ['shop', 'trails', 'items', 'boosts'] as const satisfies readonly PanelId[]
export type ShopTab = (typeof SHOP_TABS)[number]
export const isShopTab = (p: PanelId | null): p is ShopTab => SHOP_TABS.includes(p as ShopTab)

export type ToastKind = 'info' | 'success' | 'error' | 'badge'

/** Colour of the floating feedback line per kind. */
const MESSAGE_COLORS: Record<ToastKind, string> = {
  info: '#ffffff',
  success: '#7dff6b',
  error: '#ff6b6b',
  badge: '#ffe14a',
}

interface UIState {
  panel: PanelId | null
  /** Panel argument (the egg index for the egg panel). */
  panelArg: number
  eggQueue: EggResultMsg[]
  rewardQueue: RewardMsg[]
  stageClear: PadClaimedMsg | null
  tutorialRoll: number | null
  offline: OfflineMsg | null
  /** Yes/no dialog (perk purchases, deleting pets). */
  confirm: { title: string; text: string; yes: string; onYes: () => void } | null

  openPanel: (panel: PanelId, arg?: number) => void
  togglePanel: (panel: PanelId, arg?: number) => void
  closePanel: () => void
  /**
   * Short feedback ("Need 5 more Wins", "Copper Boomerang unlocked!"). There is no
   * notification panel — the screen stays clear — so it floats up above the player.
   */
  toast: (title: string, kind?: ToastKind) => void
  pushEgg: (r: EggResultMsg) => void
  shiftEgg: () => void
  pushReward: (r: RewardMsg) => void
  shiftReward: () => void
  ask: (title: string, text: string, yes: string, onYes: () => void) => void
  set: (partial: Partial<UIState>) => void
}


export const useUI = create<UIState>((set, get) => ({
  panel: null,
  panelArg: 0,
  eggQueue: [],
  rewardQueue: [],
  stageClear: null,
  tutorialRoll: null,
  offline: null,
  confirm: null,

  openPanel: (panel, arg = 0) => set({ panel, panelArg: arg }),
  togglePanel: (panel, arg = 0) =>
    set(get().panel === panel && get().panelArg === arg ? { panel: null } : { panel, panelArg: arg }),
  closePanel: () => set({ panel: null }),
  toast: (title, kind = 'info') => spawnMessage(title, MESSAGE_COLORS[kind]),
  pushEgg: (r) => set({ eggQueue: [...get().eggQueue, r] }),
  shiftEgg: () => set({ eggQueue: get().eggQueue.slice(1) }),
  pushReward: (r) => set({ rewardQueue: [...get().rewardQueue, r] }),
  shiftReward: () => set({ rewardQueue: get().rewardQueue.slice(1) }),
  ask: (title, text, yes, onYes) => set({ confirm: { title, text, yes, onYes } }),
  set: (partial) => set(partial),
}))

export const ui = () => useUI.getState()
