import { createStore } from '../persistence'
import { Leaderboards } from './Leaderboards'
import { PlayerRepository } from './PlayerRepository'

/** Process-wide singletons shared by every GameRoom. */
export const store = createStore()
export const players = new PlayerRepository(store)
export const leaderboards = new Leaderboards(store)

/**
 * Account id → the room session currently playing it. A new join for an account
 * that is already in a room kicks the old session (last tab wins).
 */
export const activeSessions = new Map<string, { kick: () => void; sessionId: string }>()
