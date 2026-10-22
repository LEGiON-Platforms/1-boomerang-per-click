import { normalizePlayerData, type PlayerData } from '@game/shared'

import type { PlayerStore } from '../persistence'

/**
 * Process-wide owner of live PlayerData objects.
 *
 * Every session for an account shares the *same* object, so a player who opens a
 * second tab can't load a stale copy, spend it, and have one tab's save clobber
 * the other's (the classic duplication exploit). The record is saved and dropped
 * from memory when the last session releases it.
 */
export class PlayerRepository {
  private live = new Map<string, { data: PlayerData; refs: number }>()
  private loading = new Map<string, Promise<PlayerData>>()

  constructor(private store: PlayerStore) {}

  async acquire(id: string, name: string, now: number): Promise<PlayerData> {
    const existing = this.live.get(id)
    if (existing) {
      existing.refs += 1
      return existing.data
    }
    let pending = this.loading.get(id)
    if (!pending) {
      pending = this.store
        .load(id)
        .then((raw) => normalizePlayerData(raw, id, name, now))
        .finally(() => this.loading.delete(id))
      this.loading.set(id, pending)
    }
    const data = await pending
    const entry = this.live.get(id)
    if (entry) {
      entry.refs += 1
      return entry.data
    }
    this.live.set(id, { data, refs: 1 })
    return data
  }

  async release(id: string): Promise<void> {
    const entry = this.live.get(id)
    if (!entry) return
    entry.refs -= 1
    if (entry.refs > 0) return
    this.live.delete(id)
    await this.save(entry.data)
  }

  async save(data: PlayerData): Promise<void> {
    try {
      await this.store.save(data)
    } catch (err) {
      console.error(`[repo] save failed for ${data.name}`, err)
    }
  }

  async saveAll(): Promise<void> {
    await Promise.all([...this.live.values()].map((e) => this.save(e.data)))
  }
}
