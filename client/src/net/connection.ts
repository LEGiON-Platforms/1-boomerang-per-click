import { Callbacks, Client, type Room } from '@colyseus/sdk'
import {
  BADGES,
  type BadgeMsg,
  C2S,
  type EggResultMsg,
  type ErrorMsg,
  ERRORS,
  formatNumber,
  PERK_SHOP,
  type PerkId,
  type LeaderboardsMsg,
  type OfflineMsg,
  type PadClaimedMsg,
  type PurchaseMsg,
  type RewardMsg,
  ROOM_NAME,
  type RunState,
  S2C,
  type SelfMsg,
  type TeleportMsg,
  TRAILS,
  TRAINING_PADS,
  BOOMERANGS,
  type ThrowResultMsg,
  type ToastMsg,
  type TutorialRewardMsg,
  type WelcomeMsg,
  levelSpeedMult,
} from '@game/shared'

import { playSfx } from '../audio/sfx'
import { onThrowResult, onRemoteThrow } from '../game/throwing'
import { confetti } from '../game/fx/particles'
import { cameraState, devPose, holdWalls, localPlayer, pending, playerScreenPoint, wallHold } from '../game/runtime'
import { game, type RoomPlayerInfo, useGame } from '../state/gameStore'
import { ui, useUI } from '../state/uiStore'
import { flyTrophies } from '../ui/floating'
import { waitForSDK } from '../bloxity/sdk'
import { getBloxityState, useBloxityStore } from '../bloxity/store'
import { getPlayerId } from './identity'
import { addRemote, clearRemotes, createRemote, pushSnapshot, remotePlayers, removeRemote } from './remote'

/** Mirrors the server's CLOSE_DUPLICATE. */
const CLOSE_DUPLICATE = 4100
/** Colyseus CloseCode.SERVER_SHUTDOWN: the server is being replaced (a deploy). */
const CLOSE_SERVER_SHUTDOWN = 4001
const RETRY_MS = 3000

/**
 * Hosted on Bloxity Legion: players join through the matchmaker, which picks (or
 * boots) a server with a free seat. Unset in local dev, where the client talks to
 * the game server directly (serverUrl()).
 */
const LEGION_GAME_ID = import.meta.env.VITE_LEGION_GAME_ID as string | undefined
/** Optional matchmaker version, e.g. "preview" to reach dev from a custom domain. */
const LEGION_VERSION = import.meta.env.VITE_LEGION_VERSION as string | undefined
/** Matchmaker retries back off up to this, and give up after GIVE_UP_MS. */
const MAX_BACKOFF_MS = 8000
const GIVE_UP_MS = 60_000

interface LegionNet {
  net: { resolveEndpoint(gameId: string, options?: { version?: string }): Promise<{ endpoint: string }> }
}

let client: Client | null = null
let room: Room | null = null
let joinName = ''
let retryTimer: number | null = null
/** When the current run of failed joins started (0 = the last join worked), and its length. */
let failingSince = 0
let failures = 0

/**
 * A Colyseus client for the next join. Through the matchmaker every resolve pins a
 * new endpoint to one server, so each one gets a fresh Client; direct connections
 * reuse theirs.
 */
async function nextClient(): Promise<Client> {
  if (!LEGION_GAME_ID) return client ?? new Client(serverUrl())
  const sdk = (await waitForSDK({ timeoutMs: 20_000 })) as LegionNet
  const { endpoint } = await sdk.net.resolveEndpoint(LEGION_GAME_ID, LEGION_VERSION ? { version: LEGION_VERSION } : undefined)
  return new Client(endpoint)
}

/**
 * Schedules another join attempt. After a failed join through the matchmaker it
 * backs off (1, 2, 4, 8 s …) and gives up after a minute — a cold start can take
 * up to ~45 s.
 */
function scheduleRetry(delayMs = RETRY_MS, afterFailure = true): void {
  if (retryTimer !== null) window.clearTimeout(retryTimer)
  if (LEGION_GAME_ID && afterFailure) {
    const t = Date.now()
    if (!failingSince) failingSince = t
    if (t - failingSince > GIVE_UP_MS) {
      retryTimer = null
      failingSince = 0
      failures = 0
      useGame.getState().setStatus('error', 'Could not reach the game servers. Please reload the page.')
      return
    }
    delayMs = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** failures)
    failures += 1
  }
  retryTimer = window.setTimeout(() => void connect(joinName), delayMs)
}

function serverUrl(): string {
  const env = import.meta.env.VITE_SERVER_URL as string | undefined
  if (env) return env
  // Vite dev / preview: the game server runs beside it on :2567. In production the
  // server serves the client, so the game connects to its own origin.
  if (import.meta.env.DEV || location.port === '4173') {
    return `${location.protocol}//${location.hostname}:2567`
  }
  return location.origin
}

export function getRoom(): Room | null {
  return room
}

// Dev-only hooks for tools/shot.ts: jump into a stage, or send any message.
if (import.meta.env.DEV) {
  const w = window as unknown as { __bpcTeleport: (s: number) => void; __bpcSend: (t: string, p?: unknown) => void }
  w.__bpcTeleport = (stage) => send(C2S.teleportStage, { stage })
  w.__bpcSend = (type, payload) => send(type, payload)
  ;(window as unknown as { __bpcUI: typeof useUI }).__bpcUI = useUI
  ;(window as unknown as { __bpcGame: typeof useGame }).__bpcGame = useGame
  ;(window as unknown as { __bpcRuntime: object }).__bpcRuntime = { localPlayer, cameraState, devPose, wallHold, remotePlayers }
}

/** Sends a message to the game room (dropped while disconnected). */
export function send(type: string, payload?: unknown): void {
  room?.send(type, payload)
}

let sentLook = ''

/** Tells the room what our Bloxity avatar looks like (on join and whenever it changes). */
export function sendAvatarLook(force = false): void {
  const { equipped, proportions } = getBloxityState()
  const look = { e: equipped ?? {}, p: proportions ?? {} }
  const key = JSON.stringify(look)
  if (!room || (!force && key === sentLook)) return
  sentLook = key
  room.send(C2S.setAvatar, { look })
}
useBloxityStore.subscribe(() => sendAvatarLook())

let connecting = false

/** Joins the game room. Idempotent: a second call while connecting/connected is ignored. */
export async function connect(name: string): Promise<void> {
  joinName = name
  if (connecting || room) return
  connecting = true
  if (retryTimer !== null) window.clearTimeout(retryTimer)
  retryTimer = null
  useGame.getState().setStatus('connecting')
  const options = { playerId: getPlayerId(), name }
  const roomParam = new URLSearchParams(location.search).get('room')
  try {
    const c = await nextClient()
    client = c
    room = roomParam
      ? await c.joinById(roomParam, options).catch(() => c.joinOrCreate(ROOM_NAME, options))
      : await c.joinOrCreate(ROOM_NAME, options)
  } catch (err) {
    console.warn('[net] join failed', err)
    connecting = false
    useGame.getState().setStatus('error', 'Could not reach the game server. Retrying…')
    scheduleRetry()
    return
  }
  connecting = false
  failingSince = 0
  failures = 0
  bindRoom(room)
}

function playerInfoList(r: Room): RoomPlayerInfo[] {
  const list: RoomPlayerInfo[] = []
  const players = (r.state as { players?: Map<string, { name: string; pid: string; level: number }> }).players
  players?.forEach((p, sessionId) => {
    list.push({ sessionId, name: p.name, pid: p.pid, level: p.level, isLocal: sessionId === r.sessionId })
  })
  return list
}

function refreshRoomPlayers(r: Room): void {
  useGame.getState().set({ roomPlayers: playerInfoList(r) })
}

interface PublicPlayer {
  name: string
  pid: string
  x: number
  y: number
  z: number
  rotY: number
  anim: number
  boomerang: number
  vip: boolean
  trail: number
  level: number
  rebirths: number
  throws: number
  avatar: string
  pets: { toArray(): string[] }
}

function bindRoom(r: Room): void {
  const store = useGame.getState()
  store.set({ roomId: r.roomId })

  r.onMessage(S2C.welcome, (m: WelcomeMsg) => {
    useGame.getState().applySelf(m.data, m.publicId, m.serverNow)
    useGame.getState().set({ run: m.run, leaderboards: m.leaderboards, roomId: m.roomId })
    useGame.getState().setStatus('connected')
    // Re-entering after a reconnect: put the player where the server has them.
    cameraState.snap = true
    // A new room (or seat) knows nothing of our avatar yet.
    sendAvatarLook(true)
  })
  r.onMessage(S2C.self, (m: SelfMsg) => useGame.getState().applySelf(m.data, m.publicId, m.serverNow))
  r.onMessage(S2C.run, (m: RunState) => useGame.getState().setRun(m))
  r.onMessage(S2C.throwResult, (m: ThrowResultMsg) => onThrowResult(m))
  r.onMessage(S2C.teleport, (m: TeleportMsg) => {
    pending.teleport = m
  })
  r.onMessage(S2C.error, (m: ErrorMsg) => {
    ui().toast(ERRORS[m.code] ?? 'Something went wrong.', 'error')
    playSfx('error')
  })
  r.onMessage(S2C.toast, (m: ToastMsg) => ui().toast(m.text, m.kind))
  r.onMessage(S2C.badge, (m: BadgeMsg) => {
    const b = BADGES[m.id]
    ui().toast(`Badge: ${b?.name ?? m.id}`, 'badge')
    playSfx('badge')
  })
  r.onMessage(S2C.eggResult, (m: EggResultMsg) => ui().pushEgg(m))
  r.onMessage(S2C.reward, (m: RewardMsg) => {
    ui().pushReward(m)
    playSfx('win')
  })
  r.onMessage(S2C.padClaimed, (m: PadClaimedMsg) => {
    useUI.getState().set({ stageClear: m })
    // Back in the lobby (after PAD_RESPAWN_MS) the walls stay down a few seconds more.
    holdWalls(m.stage)
    playSfx('win')
    confetti(localPlayer.pos.x, 2, localPlayer.pos.z, 48)
    const at = playerScreenPoint()
    flyTrophies(at.x, at.y)
  })
  r.onMessage(S2C.leaderboards, (m: LeaderboardsMsg) => useGame.getState().set({ leaderboards: m }))
  // Someone found the Lucky Block: just the sound (no notification panel).
  r.onMessage(S2C.luckyWinner, () => playSfx('lucky'))
  r.onMessage(S2C.offline, (m: OfflineMsg) => useUI.getState().set({ offline: m }))
  r.onMessage(S2C.levelUp, (m: { level: number }) => {
    ui().toast(`Level ${m.level}! Walk speed +${Math.round((levelSpeedMult(m.level) - 1) * 100)}%`, 'success')
    playSfx('levelup')
    confetti(localPlayer.pos.x, 2.5, localPlayer.pos.z, 30)
  })
  r.onMessage(S2C.tutorialReward, (m: TutorialRewardMsg) => useUI.getState().set({ tutorialRoll: m.index }))
  r.onMessage(S2C.purchase, (m: PurchaseMsg) => {
    playSfx('buy')
    if (m.kind === 'boomerang') ui().toast(`${BOOMERANGS[m.id as number]?.name} Boomerang unlocked!`, 'success')
    else if (m.kind === 'pad') ui().toast(`Training pad unlocked: x${TRAINING_PADS[m.id as number]?.mult} Power!`, 'success')
    else if (m.kind === 'trail') ui().toast(`${TRAILS[m.id as number]?.name} Trail unlocked!`, 'success')
    else ui().toast(`${PERK_SHOP[m.id as PerkId]?.name ?? 'Item'} unlocked!`, 'success')
  })
  r.onMessage(S2C.rebirthDone, (m: { rebirths: number }) => {
    playSfx('rebirth')
    ui().toast(`Rebirth ${m.rebirths}! Power x${m.rebirths + 1}`, 'success')
    confetti(localPlayer.pos.x, 2, localPlayer.pos.z, 60)
  })

  // --- Synced room state ----------------------------------------------------
  const cb = Callbacks.get(r)
  cb.onAdd('players' as never, ((p: PublicPlayer, sessionId: string) => {
    refreshRoomPlayers(r)
    if (sessionId === r.sessionId) return
    const remote = createRemote(sessionId, p.name, p.pid, p.x, p.y, p.z, p.rotY)
    addRemote(remote)
    let lastThrows = p.throws
    const applyCosmetics = () => {
      remote.name = p.name
      remote.anim = p.anim
      remote.boomerang = p.boomerang
      remote.vip = p.vip
      remote.trail = p.trail
      remote.level = p.level
      remote.rebirths = p.rebirths
      remote.pets = p.pets?.toArray?.() ?? []
      remote.avatar = p.avatar ?? ''
    }
    applyCosmetics()
    cb.onChange(p as never, () => {
      pushSnapshot(remote, p.x, p.y, p.z, p.rotY)
      if (p.name !== remote.name || p.level !== remote.level) refreshRoomPlayers(r)
      applyCosmetics()
      if (p.throws !== lastThrows) {
        lastThrows = p.throws
        onRemoteThrow(remote)
      }
    })
    cb.onChange(p as never, 'pets' as never, (() => {
      remote.pets = p.pets?.toArray?.() ?? []
    }) as never)
  }) as never, true)

  cb.onRemove('players' as never, ((_p: PublicPlayer, sessionId: string) => {
    removeRemote(sessionId)
    refreshRoomPlayers(r)
  }) as never)

  const lucky = (r.state as { lucky?: { phase: number; secondsLeft: number; x: number; z: number } }).lucky
  const pushLucky = () => {
    const l = (r.state as { lucky?: { phase: number; secondsLeft: number; x: number; z: number } }).lucky
    if (l) useGame.getState().set({ lucky: { phase: l.phase, secondsLeft: l.secondsLeft, x: l.x, z: l.z } })
  }
  if (lucky) cb.onChange(lucky as never, pushLucky)
  else cb.listen('lucky' as never, pushLucky as never)

  // --- Connection lifecycle ---------------------------------------------------
  r.onDrop(() => useGame.getState().setStatus('reconnecting', 'Connection lost — reconnecting…'))
  r.onReconnect(() => {
    useGame.getState().setStatus('connected')
    send(C2S.requestSync)
  })
  r.onLeave((code: number) => {
    clearRemotes()
    room = null
    if (code === CLOSE_DUPLICATE) {
      useGame.getState().setStatus('kicked', 'You started playing in another tab.')
      return
    }
    useGame.getState().setStatus('error', 'Disconnected from the server. Reconnecting…')
    // A server being replaced (deploy / scale-down) has already saved us: rejoin
    // right away — through the matchmaker that lands on a fresh server.
    scheduleRetry(code === CLOSE_SERVER_SHUTDOWN ? 300 : RETRY_MS, false)
  })
}

export { formatNumber, game }
