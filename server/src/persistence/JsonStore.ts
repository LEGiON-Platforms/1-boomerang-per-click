import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { LeaderboardEntry, PlayerData } from '@game/shared'

import type { LeaderboardField, PlayerStore } from './Store'

/** Coalesces bursts of saves into one disk write. */
const FLUSH_DELAY_MS = 1000

/**
 * Development store: every player in one JSON file, kept in memory and flushed
 * atomically (write temp file, then rename) shortly after each change.
 */
export class JsonStore implements PlayerStore {
  readonly kind = 'json' as const
  private players = new Map<string, PlayerData>()
  private file: string
  private flushTimer: NodeJS.Timeout | null = null
  private writing: Promise<void> = Promise.resolve()

  constructor(dir: string) {
    this.file = path.join(dir, 'players.json')
  }

  async init(): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true })
    try {
      const raw = JSON.parse(await fs.readFile(this.file, 'utf8')) as Record<string, PlayerData>
      for (const [id, data] of Object.entries(raw)) this.players.set(id, data)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
  }

  async load(id: string): Promise<unknown | null> {
    const data = this.players.get(id)
    return data ? structuredClone(data) : null
  }

  async save(data: PlayerData): Promise<void> {
    this.players.set(data.id, structuredClone(data))
    this.scheduleFlush()
  }

  async top(field: LeaderboardField, limit: number): Promise<LeaderboardEntry[]> {
    return [...this.players.values()]
      .filter((p) => (p[field] ?? 0) > 0)
      .sort((a, b) => (b[field] ?? 0) - (a[field] ?? 0))
      .slice(0, limit)
      .map((p) => ({ name: p.name, value: p[field] ?? 0 }))
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    await this.flush()
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      void this.flush()
    }, FLUSH_DELAY_MS)
  }

  private flush(): Promise<void> {
    // Serialise writes so two flushes can never interleave on disk.
    this.writing = this.writing.then(async () => {
      const tmp = `${this.file}.tmp`
      await fs.writeFile(tmp, JSON.stringify(Object.fromEntries(this.players)))
      await fs.rename(tmp, this.file)
    })
    return this.writing.catch((err) => console.error('[store] JSON flush failed', err))
  }
}
