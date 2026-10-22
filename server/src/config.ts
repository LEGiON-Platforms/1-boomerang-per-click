/** Server settings, all overridable through environment variables. */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
/** server/ — works from both src/ (tsx) and dist/ (bundled). */
const serverRoot = path.resolve(here, '..')

export const CONFIG = {
  port: Number(process.env.PORT || 2567),
  /** When set, players are stored in MongoDB; otherwise in a JSON file (dev). */
  mongoUrl: process.env.MONGO_URL || '',
  dataDir: process.env.DATA_DIR || path.join(serverRoot, 'data'),
  /** Origins allowed to call the HTTP API from a browser. */
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /** Built client to serve in production (same origin as the game server). */
  clientDist: process.env.CLIENT_DIST || path.resolve(serverRoot, '..', 'client', 'dist'),
  autosaveSeconds: 30,
  leaderboardRefreshSeconds: 60,
  leaderboardSize: 10,
} as const
