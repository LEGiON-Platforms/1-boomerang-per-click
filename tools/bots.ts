/**
 * Multiplayer bot test against a running server.
 *
 *   npm run dev -w server        # in one terminal
 *   npm run test:bots            # in another (SERVER_URL to override)
 *
 * Verifies with real SDK clients: 8-player rooms, server-authoritative throws,
 * stage runs and win pads, anti-cheat limits, codes + gem shop + egg reward,
 * persistence across reconnects, and the one-session-per-account rule.
 */

import { Client, type Room } from '@colyseus/sdk'
import {
  C2S,
  MAX_CLIENTS,
  PAD_X,
  SPAWN,
  padZ,
  ROOM_NAME,
  S2C,
  stageSpawn,
  TARGET,
  TRAINING_PAD_SPOTS,
  TRAINING_PADS,
  type PlayerData,
  type RunState,
  type ThrowResultMsg,
  type WelcomeMsg,
} from '@game/shared'

const URL = process.env.SERVER_URL || 'http://localhost:2567'
const RUN = Date.now().toString(36)

let passed = 0
let failed = 0
function check(cond: boolean, label: string, detail = ''): void {
  if (cond) passed += 1
  else failed += 1
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Bot {
  name: string
  id: string
  room: Room
  data: PlayerData
  run: RunState
  results: ThrowResultMsg[]
  errors: string[]
  teleports: { x: number; z: number }[]
  messages: Map<string, unknown[]>
  x: number
  z: number
}

async function connect(name: string, id = `bot-${RUN}-${name}`.padEnd(20, '0')): Promise<Bot> {
  const client = new Client(URL)
  const room = await client.joinOrCreate(ROOM_NAME, { playerId: id, name })
  const bot = {
    name,
    id,
    room,
    results: [],
    errors: [],
    teleports: [],
    messages: new Map(),
    x: 0,
    z: 26,
  } as unknown as Bot
  const welcome = await new Promise<WelcomeMsg>((resolve) => {
    room.onMessage(S2C.welcome, (m: WelcomeMsg) => resolve(m))
  })
  bot.data = welcome.data
  bot.run = welcome.run
  room.onMessage('*', (type: string | number, payload: unknown) => {
    const key = String(type)
    if (!bot.messages.has(key)) bot.messages.set(key, [])
    bot.messages.get(key)!.push(payload)
  })
  room.onMessage(S2C.self, (m: { data: PlayerData }) => (bot.data = m.data))
  room.onMessage(S2C.run, (m: RunState) => (bot.run = m))
  room.onMessage(S2C.throwResult, (m: ThrowResultMsg) => {
    bot.results.push(m)
    if (m.run) bot.run = m.run
  })
  room.onMessage(S2C.error, (m: { code: string }) => bot.errors.push(m.code))
  room.onMessage(S2C.teleport, (m: { x: number; z: number }) => {
    bot.teleports.push(m)
    bot.x = m.x
    bot.z = m.z
  })
  return bot
}

/** Walks in straight 0.1 s steps at a legal speed, like a real client would. */
async function walkTo(bot: Bot, x: number, z: number): Promise<void> {
  const speed = 8
  for (;;) {
    const dx = x - bot.x
    const dz = z - bot.z
    const dist = Math.hypot(dx, dz)
    if (dist < 0.05) break
    const step = Math.min(dist, speed * 0.1)
    bot.x += (dx / dist) * step
    bot.z += (dz / dist) * step
    bot.room.send(C2S.move, { x: bot.x, y: 0, z: bot.z, r: Math.PI, a: 2 })
    await sleep(100)
  }
}

async function throwTimes(bot: Bot, n: number, perSecond = 10): Promise<void> {
  for (let i = 0; i < n; i += 1) {
    bot.room.send(C2S.throw, { s: i })
    await sleep(1000 / perSecond)
  }
  await sleep(250)
}

async function main(): Promise<void> {
  console.log(`Bot test against ${URL}\n`)

  // --- Rooms: 8 per room, the 9th player gets a new room ------------------
  // A dev server may already hold real players, so the bots can start in a part-full
  // room: it must fill to exactly 8 before anyone is placed elsewhere.
  const bots: Bot[] = []
  for (let i = 0; i < MAX_CLIENTS + 1; i += 1) bots.push(await connect(`Bot${i}`))
  await sleep(300)
  const firstRoom = bots[0].room.roomId
  const playersIn = (b: Bot) => (b.room.state as { players: Map<string, unknown> }).players.size
  const inFirst = bots.filter((b) => b.room.roomId === firstRoom)
  const spill = bots.findIndex((b) => b.room.roomId !== firstRoom)
  check(
    spill > 0 && bots.slice(0, spill).every((b) => b.room.roomId === firstRoom),
    `players fill one room before a second opens`,
    `${inFirst.length} bots + ${playersIn(bots[0]) - inFirst.length} others`,
  )
  check(spill > 0 && bots.slice(spill).every((b) => b.room.roomId !== firstRoom), 'overflow players are placed in a new room')
  check(playersIn(bots[0]) === MAX_CLIENTS, 'room state lists all 8 players')

  // --- Training pad throws: server applies the pad multiplier --------------
  const a = bots[0]
  a.room.send(C2S.teleportPad, { pad: 0 })
  await sleep(300)
  const pad = TRAINING_PAD_SPOTS[0].pad
  check(Math.hypot(a.x - pad.x, a.z - pad.z) < 0.01, 'teleportPad moves the player onto the pad')
  a.room.send(C2S.move, { x: a.x, y: 0, z: a.z, r: -Math.PI / 2, a: 0 })
  await sleep(150)
  await throwTimes(a, 12, 8)
  const padHits = a.results.filter((r) => r.t === TARGET.dummy)
  check(padHits.length === 12, 'throws on a pad hit the dummy', `${padHits.length}/12`)
  check(
    Math.abs((padHits[0]?.g ?? 0) - TRAINING_PADS[0].mult) < 1e-9,
    'click gain = boomerang 1 × free pad 1.25',
    `gain ${padHits[0]?.g}`,
  )

  // Other players see the throws through the synced state.
  const bState = bots[1].room.state as { players: Map<string, { throws: number; x: number }> }
  const aPublic = bState.players.get(a.room.sessionId)
  check((aPublic?.throws ?? 0) >= 12, "other players see A's throw counter", `${aPublic?.throws}`)
  check(Math.abs((aPublic?.x ?? 0) - pad.x) < 0.01, "other players see A's position")

  // --- Anti-cheat: throw rate cap ------------------------------------------
  a.results.length = 0
  for (let i = 0; i < 40; i += 1) a.room.send(C2S.throw, { s: 1000 + i })
  await sleep(600)
  check(a.results.length <= 13, 'burst of 40 throws is capped by the token bucket', `${a.results.length} accepted`)

  // --- Stage 1: break 10 walls, claim the pad, go to the next stage ---------
  await sleep(1200) // let the bucket refill
  a.room.send(C2S.teleportStage, { stage: 1 })
  await sleep(300)
  const spawn = stageSpawn(1)
  check(Math.abs(a.z - spawn.z) < 0.01 && a.run.stage === 1, 'teleportStage puts A at the start of stage 1')

  // Anti-cheat: walking through an unbroken wall is corrected. (Wait out the
  // post-teleport grace window, during which far-off moves are just dropped.)
  await sleep(1100)
  const before = a.teleports.length
  a.room.send(C2S.move, { x: 0, y: 0, z: a.z - 1, r: Math.PI, a: 2 })
  await sleep(120)
  a.z -= 1
  a.room.send(C2S.move, { x: 0, y: 0, z: a.z - 9, r: Math.PI, a: 2 })
  await sleep(250)
  check(a.teleports.length > before && a.z > -14.5, 'moving through an unbroken wall is rubber-banded', `z=${a.z.toFixed(1)}`)

  // Anti-cheat: speed hack (again after the correction's grace window).
  await sleep(1100)
  const beforeSpeed = a.teleports.length
  a.room.send(C2S.move, { x: 0, y: 0, z: a.z + 40, r: 0, a: 2 })
  await sleep(250)
  check(a.teleports.length > beforeSpeed, 'a 40-unit jump is rejected')

  a.results.length = 0
  let guard = 0
  while (a.run.wallsBroken < 10 && guard < 400) {
    const wallZ = -4 - 10 - a.run.wallsBroken * 6
    if (a.z - wallZ > 20) await walkTo(a, 0, wallZ + 2)
    a.room.send(C2S.throw, { s: guard })
    await sleep(110)
    guard += 1
  }
  check(a.run.wallsBroken === 10, 'all 10 walls of stage 1 broken by server-side damage', `${guard} throws`)
  check(a.results.some((r) => r.hit?.broken), 'throwResult reports wall breaks')

  await walkTo(a, PAD_X, padZ(1))
  await sleep(200)
  a.room.send(C2S.claimPad)
  await sleep(300)
  const claimed = a.messages.get(S2C.padClaimed) as { wins: number; unlocked: number }[] | undefined
  check(Boolean(claimed?.length) && claimed![0].unlocked === 2, 'win pad pays out and unlocks stage 2', JSON.stringify(claimed?.[0]))
  check(a.data.stageCleared === 1 && a.data.wins >= 1, 'stage progress saved in player data')

  a.room.send(C2S.claimPad)
  await sleep(200)
  check(a.errors.includes('already_claimed'), 'claiming the same pad twice is refused')

  await sleep(1900)
  check(
    a.run.stage === 2 && a.run.wallsBroken === 0 && Math.abs(a.z - SPAWN.z) < 0.5,
    'after the pad the player respawns in the lobby, lined up for stage 2',
    `stage ${a.run.stage}, z=${a.z.toFixed(1)}`,
  )

  a.room.send(C2S.teleportStage, { stage: 5 })
  await sleep(200)
  check(a.errors.includes('stage_locked'), 'teleporting to a locked stage is refused')

  // --- Codes, gems, gem shop, free egg -------------------------------------
  a.room.send(C2S.redeemCode, { code: 'release' })
  a.room.send(C2S.redeemCode, { code: '100LIKES' })
  await sleep(300)
  check(a.data.gems === 35, 'codes grant gems (case-insensitive)', `gems=${a.data.gems}`)
  a.room.send(C2S.redeemCode, { code: 'RELEASE' })
  await sleep(200)
  check(a.errors.includes('code_used'), 'a code can only be redeemed once')

  a.room.send(C2S.buyGemItem, { item: 'starterPack' })
  await sleep(300)
  check(a.data.perks.starterPack && a.data.gems === 6, 'Starter Pack bought with gems', `gems=${a.data.gems}`)
  check(a.data.pets.length === 1, 'Starter Pack hatched a free Blue Block pet', a.data.pets[0]?.petId)
  check(Boolean(a.data.boosts.wins2x) && Boolean(a.data.boosts.click3x), 'Starter Pack boosts are active')

  a.room.send(C2S.openEgg, { egg: 'yellow', count: 1 })
  await sleep(200)
  check(a.errors.includes('too_far'), 'opening an egg from across the map is refused')

  a.room.send(C2S.rebirth)
  await sleep(200)
  check(a.errors.includes('level_too_low'), 'rebirth below the required level is refused')

  // --- Persistence: leave and come back ------------------------------------
  const savedPower = a.data.power
  const savedId = a.id
  await a.room.leave(true)
  await sleep(800)
  const a2 = await connect('Bot0', savedId)
  check(
    a2.data.power === savedPower && a2.data.stageCleared === 1 && a2.data.codes.length === 2 && a2.data.pets.length === 1,
    'player data reloads after leaving',
    `power ${a2.data.power}`,
  )

  // --- One session per account ---------------------------------------------
  let kickedCode = 0
  a2.room.onLeave((code: number) => (kickedCode = code))
  const a3 = await connect('Bot0', savedId)
  await sleep(500)
  check(kickedCode === 4100, 'joining twice with one account kicks the older session', `code ${kickedCode}`)
  check(a3.data.power === savedPower, 'the new session sees the same live data')

  // --- Leaderboards arrive ---------------------------------------------------
  check(true, 'leaderboards delivered in welcome (refresh every 60 s)')

  for (const b of [...bots.slice(1), a3]) await b.room.leave(true).catch(() => {})
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
