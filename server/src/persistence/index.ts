import { CONFIG } from '../config'
import { JsonStore } from './JsonStore'
import { MongoStore } from './MongoStore'
import type { PlayerStore } from './Store'

export type { LeaderboardField, PlayerStore } from './Store'

/** MongoDB when MONGO_URL is set, otherwise the dev JSON file store. */
export function createStore(): PlayerStore {
  return CONFIG.mongoUrl ? new MongoStore(CONFIG.mongoUrl) : new JsonStore(CONFIG.dataDir)
}
