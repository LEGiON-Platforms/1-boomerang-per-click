import { createHash } from 'node:crypto'

import type { Client, Deferred } from '@colyseus/core'
import {
  createRun,
  type PlayerData,
  type RunState,
  SPAWN,
  type StageRun,
  THROW,
  wallHp,
  WALLS_PER_STAGE,
} from '@game/shared'

import type { PlayerState } from './schema'

/** Public id shown to other players: a hash of the secret account key. */
export function publicIdFor(accountId: string): string {
  return createHash('sha256').update(`bpc:${accountId}`).digest('hex').slice(0, 16)
}

/** Token bucket: refills `rate` per second up to `capacity`. */
export class TokenBucket {
  private tokens: number
  private last: number

  constructor(
    private rate: number,
    private capacity: number,
    now: number,
  ) {
    this.tokens = capacity
    this.last = now
  }

  take(now: number): boolean {
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.rate)
    this.last = now
    if (this.tokens < 1) return false
    this.tokens -= 1
    return true
  }
}

/** Everything the room tracks for one connected player. */
export class PlayerSession {
  readonly publicId: string
  run: StageRun = createRun(1)
  pos: { x: number; y: number; z: number; rotY: number } = { x: SPAWN.x, y: 0, z: SPAWN.z, rotY: SPAWN.rotY }
  lastMoveAt: number
  /** Server-initiated teleports: moves that disagree are ignored until this time. */
  teleportUntil = 0
  readonly throws: TokenBucket
  /** Needs a full `self` resend (slow-changing fields like quest progress). */
  syncDirty = false
  /** Needs saving to the store. */
  saveDirty = false
  /** A coalesced save is already queued. */
  saveScheduled = false
  level: number
  /** Pending return to the lobby after a win pad. */
  respawnTimer: { clear(): void } | null = null
  /** When the player came into the lobby (ms); 0 while out in the corridor. */
  lobbySince = 0
  /** While dropped: the held reconnection (rejecting it ends the session now). */
  reconnection: Deferred<Client> | null = null

  constructor(
    /** Replaced on reconnection. */
    public client: Client,
    readonly data: PlayerData,
    readonly state: PlayerState,
    now: number,
    level: number,
  ) {
    this.publicId = publicIdFor(data.id)
    this.lastMoveAt = now
    this.throws = new TokenBucket(THROW.maxPerSecond, THROW.maxPerSecond, now)
    this.level = level
  }

  runState(): RunState {
    const r = this.run
    return {
      stage: r.stage,
      wallsBroken: r.wallsBroken,
      wallHp: r.wallHp,
      wallMax: r.wallsBroken < WALLS_PER_STAGE ? wallHp(r.stage, r.wallsBroken + 1) : 0,
      padClaimed: r.padClaimed,
    }
  }
}
