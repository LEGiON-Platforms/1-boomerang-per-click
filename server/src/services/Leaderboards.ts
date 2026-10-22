import type { LeaderboardsMsg } from '@game/shared'

import { CONFIG } from '../config'
import type { PlayerStore } from '../persistence'

type Listener = (boards: LeaderboardsMsg) => void

/** Global top-10 boards, refreshed from the store every minute and pushed to rooms. */
export class Leaderboards {
  private current: LeaderboardsMsg = { wins: [], stage: [], rebirths: [], updatedAt: 0 }
  private listeners = new Set<Listener>()
  private timer: NodeJS.Timeout | null = null

  constructor(private store: PlayerStore) {}

  get latest(): LeaderboardsMsg {
    return this.current
  }

  start(): void {
    void this.refresh()
    this.timer = setInterval(() => void this.refresh(), CONFIG.leaderboardRefreshSeconds * 1000)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  async refresh(): Promise<void> {
    try {
      const n = CONFIG.leaderboardSize
      const [wins, stage, rebirths] = await Promise.all([
        this.store.top('totalWins', n),
        this.store.top('bestStageEver', n),
        this.store.top('rebirths', n),
      ])
      this.current = { wins, stage, rebirths, updatedAt: Date.now() }
      for (const fn of this.listeners) fn(this.current)
    } catch (err) {
      console.error('[leaderboards] refresh failed', err)
    }
  }
}
