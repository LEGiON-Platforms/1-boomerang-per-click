/**
 * Server settings, all overridable through environment variables. On Bloxity
 * Legion the platform injects PORT, CLIENT_ORIGIN, MONGODB_URI, JWT_SECRET,
 * BLOXITY_GAME_ID, BLOXITY_CHANNEL and POD_NAME (see README → Hosting).
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
/** server/ — works from both src/ (tsx) and dist/ (bundled). */
const serverRoot = path.resolve(here, '..')

/** The game's id on Bloxity (its hosted URLs are derived from it). */
const GAME_ID = process.env.BLOXITY_GAME_ID || '1-boomerang-per-click'

const list = (v: string) =>
  v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

export const CONFIG = {
  port: Number(process.env.PORT || 2567),
  /** When set, players are stored in MongoDB; otherwise in a JSON file (dev). */
  mongoUrl: process.env.MONGODB_URI || process.env.MONGO_URL || '',
  dataDir: process.env.DATA_DIR || path.join(serverRoot, 'data'),
  /**
   * Origins allowed to call the HTTP API from a browser: local dev, the game's
   * Bloxity-hosted sites, and the platform's CLIENT_ORIGIN (a custom domain).
   */
  allowedOrigins: [
    ...list(process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173'),
    `https://${GAME_ID}.play.bloxity.io`,
    `https://${GAME_ID}.dev.play.bloxity.io`,
    ...list(process.env.CLIENT_ORIGIN || ''),
  ],
  /** Hosting details, for logs only. */
  host: {
    gameId: GAME_ID,
    channel: process.env.BLOXITY_CHANNEL || 'local',
    pod: process.env.POD_NAME || '',
  },
  /** Built client to serve in production (same origin as the game server). */
  clientDist: process.env.CLIENT_DIST || path.resolve(serverRoot, '..', 'client', 'dist'),
  autosaveSeconds: 30,
  leaderboardRefreshSeconds: 60,
  leaderboardSize: 10,
} as const
