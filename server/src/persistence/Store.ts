import type { LeaderboardEntry, PlayerData } from '@game/shared'

export type LeaderboardField = 'totalWins' | 'bestStageEver' | 'rebirths'

/** Where player records live. MongoDB in production, a JSON file in dev. */
export interface PlayerStore {
  readonly kind: 'mongo' | 'json'
  init(): Promise<void>
  /** The raw stored record, or null for a new player. */
  load(id: string): Promise<unknown | null>
  save(data: PlayerData): Promise<void>
  top(field: LeaderboardField, limit: number): Promise<LeaderboardEntry[]>
  /** Flush pending writes and disconnect. */
  close(): Promise<void>
}
