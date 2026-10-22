import { existsSync } from 'node:fs'
import path from 'node:path'

import { defineRoom, defineServer } from '@colyseus/core'
import { WebSocketTransport } from '@colyseus/ws-transport'
import { ROOM_NAME } from '@game/shared'
import cors from 'cors'
import express from 'express'

import { CONFIG } from './config'
import { GameRoom } from './rooms/GameRoom'
import { leaderboards, players, store } from './services'

const server = defineServer({
  transport: new WebSocketTransport({ pingInterval: 5000, pingMaxRetries: 3 }),
  rooms: { [ROOM_NAME]: defineRoom(GameRoom) },
  greet: false,

  beforeListen: async () => {
    await store.init()
    leaderboards.start()
    console.log(`[server] player store: ${store.kind}${store.kind === 'json' ? ` (${CONFIG.dataDir})` : ''}`)
  },

  express: (app) => {
    app.use(cors({ origin: CONFIG.allowedOrigins, credentials: true }))
    app.use(express.json({ limit: '32kb' }))

    app.get('/api/health', (_req, res) => {
      res.json({ ok: true, store: store.kind })
    })

    app.get('/api/leaderboards', (_req, res) => {
      res.json(leaderboards.latest)
    })

    /**
     * Auth passthrough for the Bloxity SDK (`Legion.SDK.auth.authenticateWithServer`).
     * Guest accounts are keyed by the UUID the client keeps in localStorage, so this
     * is not on the gameplay path. Before a Bloxity login is ever trusted as an
     * account key, `req.body.token` must be verified against Bloxity — the body's
     * `user` is attacker-controlled.
     */
    app.post('/api/legion-auth', (req, res) => {
      res.json({ accessToken: 'stub', user: { legionId: req.body?.user?._id } })
    })

    /** Platform purchase webhook. Responds 200 immediately; the game sells nothing for money. */
    app.post('/api/legion-webhook', (_req, res) => {
      res.sendStatus(200)
    })

    // Production: serve the built client from the same origin as the game server.
    if (existsSync(CONFIG.clientDist)) {
      app.use(express.static(CONFIG.clientDist, { maxAge: '1h', index: false }))
      app.use((req, res, next) => {
        if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/matchmake')) return next()
        res.sendFile(path.join(CONFIG.clientDist, 'index.html'))
      })
    }
  },
})

server.onShutdown(async () => {
  leaderboards.stop()
  await players.saveAll()
  await store.close()
})

await server.listen(CONFIG.port)
console.log(`[server] listening on http://localhost:${CONFIG.port}`)
