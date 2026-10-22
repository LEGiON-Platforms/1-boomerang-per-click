import {
  createRun,
  type LeaderboardsMsg,
  type PlayerData,
  type RunState,
  wallHp,
} from '@game/shared'
import { create } from 'zustand'

/**
 * What the server has told us about our own player, plus room-level info the HUD
 * shows. Written by net/connection.ts (message handlers) and the 10 Hz logic tick
 * — never from inside a useFrame.
 */

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'kicked'

export interface RoomPlayerInfo {
  sessionId: string
  name: string
  pid: string
  level: number
  isLocal: boolean
}

export interface LuckyInfo {
  phase: number
  secondsLeft: number
  x: number
  z: number
}

export type InteractKind = 'trails' | 'pedestal' | 'egg' | 'rebirth'

export interface InteractTarget {
  kind: InteractKind
  /** Pedestal slot or egg index. */
  index: number
}

const run1 = createRun(1)

interface GameStoreState {
  status: ConnectionStatus
  statusText: string
  data: PlayerData | null
  publicId: string
  roomId: string
  /** serverNow − Date.now() at the last sync, for countdowns. */
  serverOffset: number
  /** Date.now() when `data` was last received (playtime ticks on from there). */
  syncedAt: number
  run: RunState
  /** Display copies of the fast-changing numbers (updated per throw). */
  power: number
  wins: number
  /** Lifetime power earned (player XP), advanced locally per throw between syncs. */
  xp: number
  leaderboards: LeaderboardsMsg
  lucky: LuckyInfo
  roomPlayers: RoomPlayerInfo[]
  /** Stage area the player stands in (0 = lobby). */
  stageHere: number
  /** Training pad the player stands on (-1 = none). */
  onPad: number
  nearInteract: InteractTarget | null
  /** Sessions whose name tags are close enough to draw. */
  nearbyTags: string[]
  /** Other players drawn as full Bloxity avatars, with their looks. */
  fullAvatars: { id: string; avatar: string }[]
  autoThrow: boolean
  autoWin: boolean

  setStatus: (status: ConnectionStatus, text?: string) => void
  applySelf: (data: PlayerData, publicId: string, serverNow: number) => void
  setRun: (run: RunState) => void
  setPowerWins: (power: number, wins?: number) => void
  addXp: (amount: number) => void
  set: (partial: Partial<GameStoreState>) => void
}

export const useGame = create<GameStoreState>((set) => ({
  status: 'idle',
  statusText: '',
  data: null,
  publicId: '',
  roomId: '',
  serverOffset: 0,
  syncedAt: 0,
  run: {
    stage: 1,
    wallsBroken: 0,
    wallHp: run1.wallHp,
    wallMax: wallHp(1, 1),
    padClaimed: false,
  },
  power: 0,
  wins: 0,
  xp: 0,
  leaderboards: { wins: [], stage: [], rebirths: [], updatedAt: 0 },
  lucky: { phase: 0, secondsLeft: 0, x: 0, z: 0 },
  roomPlayers: [],
  stageHere: 0,
  onPad: -1,
  nearInteract: null,
  nearbyTags: [],
  fullAvatars: [],
  autoThrow: false,
  autoWin: false,

  setStatus: (status, text = '') => set({ status, statusText: text }),
  applySelf: (data, publicId, serverNow) =>
    set({
      data,
      publicId,
      power: data.power,
      wins: data.wins,
      xp: data.stats.powerEarned,
      serverOffset: serverNow - Date.now(),
      syncedAt: Date.now(),
    }),
  setRun: (run) => set({ run }),
  setPowerWins: (power, wins) => set(wins === undefined ? { power } : { power, wins }),
  addXp: (amount) => set((s) => ({ xp: s.xp + amount })),
  set: (partial) => set(partial),
}))

/** Non-reactive snapshot for frame loops and event handlers. */
export const game = () => useGame.getState()

/** Server clock estimate (ms). */
export const serverNow = () => Date.now() + useGame.getState().serverOffset
