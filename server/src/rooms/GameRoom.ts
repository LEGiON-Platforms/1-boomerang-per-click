import { type Client, Room } from '@colyseus/core'
import {
  addFriend,
  addPlaytime,
  advanceTutorial,
  ANIM,
  applyThrowGain,
  bestBoomerangId,
  buyPerk,
  buyNextBoomerang,
  buyTrail,
  C2S,
  checkBadges,
  claimDaily,
  claimGift,
  claimPad,
  claimQuest,
  grantLuckyReward,
  collectPumpkin,
  constrainPosition,
  createRun,
  deletePet,
  distance2D,
  EGG_SPOTS,
  EGGS,
  encodePublicPet,
  equipBestPets,
  equipPet,
  equippedPetInstances,
  equipTrail,
  type ErrorCode,
  type PerkId,
  PERK_SHOP,
  grantOfflineEarnings,
  HALLOWEEN,
  hitWall,
  INTERACT_RADIUS,
  INTERACT_TOLERANCE,
  isPadUnlocked,
  isStageUnlocked,
  type JoinOptions,
  LUCKY_BLOCK,
  LUCKY_PHASE,
  LUCKY_SPOTS,
  MAX_CLIENTS,
  levelSpeedMult,
  MAX_SPEED,
  mergePets,
  type MoveMsg,
  onWinPad,
  openEgg,
  type OpenEggMsg,
  padAtPosition,
  PLAYER_ID_PATTERN,
  playerLevel,
  PLAYTIME_GIFTS,
  PUMPKIN_SPOTS,
  questDef,
  RARITIES,
  type Rarity,
  rarityIndex,
  RECONNECT_SECONDS,
  redeemCode,
  rebirth,
  removeFriend,
  type RewardSource,
  type RewardSummary,
  rollTutorialReward,
  S2C,
  sanitizeAvatarLook,
  sanitizeName,
  SPAWN,
  STAGE_COUNT,
  inCorridor,
  stageSpawn,
  TARGET,
  THROW,
  type ThrowMsg,
  type ThrowResultMsg,
  TRAINING_PAD_SPOTS,
  unequipPet,
  wallZ,
  WALLS_PER_STAGE,
  refreshPeriods,
} from '@game/shared'

import { CONFIG } from '../config'
import { activeSessions, leaderboards, players } from '../services'
import { PlayerSession, publicIdFor } from './PlayerSession'
import { GameState, PlayerState } from './schema'

/** Close code sent to a session replaced by the same account joining elsewhere. */
export const CLOSE_DUPLICATE = 4100

/** Extra throw reach the server allows for latency between move updates. */
const RANGE_TOLERANCE = 3
/** Corrections are only sent when the client is off by more than this. */
const CORRECTION_DISTANCE = 1.0
/** Celebration time on the win pad before the player respawns in the lobby. */
const PAD_RESPAWN_MS = 1800

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)
const finite = (...v: unknown[]) => v.every((n) => typeof n === 'number' && Number.isFinite(n))

export class GameRoom extends Room<{ state: GameState }> {
  maxClients = MAX_CLIENTS
  /** Anything faster than this is a flood: the client is disconnected. */
  maxMessagesPerSecond = 80

  private sessions = new Map<string, PlayerSession>()
  private unsubscribeBoards: (() => void) | null = null

  onCreate(): void {
    this.setState(new GameState())
    this.state.lucky.phase = LUCKY_PHASE.countdown
    this.state.lucky.secondsLeft = LUCKY_BLOCK.intervalSeconds

    this.registerHandlers()

    this.clock.setInterval(() => this.tickSecond(), 1000)
    this.clock.setInterval(() => this.flushSync(), 2000)
    this.clock.setInterval(() => this.autosave(), CONFIG.autosaveSeconds * 1000)
    this.unsubscribeBoards = leaderboards.subscribe((boards) => this.broadcast(S2C.leaderboards, boards))
  }

  /* -------------------------------------------------------------------------
   * Lifecycle
   * ----------------------------------------------------------------------- */

  async onJoin(client: Client, options: JoinOptions): Promise<void> {
    const id = String(options?.playerId ?? '')
    if (!PLAYER_ID_PATTERN.test(id)) throw new Error('Invalid player id')
    const name = sanitizeName(options?.name) || `Guest${id.slice(0, 4)}`

    // One live session per account: the newest join wins.
    activeSessions.get(id)?.kick()

    const now = Date.now()
    const data = await players.acquire(id, name, now)
    data.name = name
    refreshPeriods(data, now)
    const offline = grantOfflineEarnings(data, now)
    data.lastSeen = now

    const ps = new PlayerState()
    ps.name = name
    ps.pid = publicIdFor(id)
    ps.x = SPAWN.x
    ps.z = SPAWN.z
    ps.rotY = SPAWN.rotY

    const session = new PlayerSession(client, data, ps, now, playerLevel(data))
    this.sessions.set(client.sessionId, session)
    this.state.players.set(client.sessionId, ps)
    this.syncPublic(session)

    activeSessions.set(id, {
      sessionId: client.sessionId,
      kick: () => client.leave(CLOSE_DUPLICATE, 'Signed in from another tab'),
    })

    this.sendWelcome(session)
    if (offline.wins > 0) client.send(S2C.offline, offline)
    this.awardBadges(session)
  }

  onDrop(client: Client, code?: number): void {
    // Replaced by a newer session for the same account: free the seat now
    // (without allowReconnection, Colyseus goes straight on to onLeave).
    if (code === CLOSE_DUPLICATE) return
    const s = this.sessions.get(client.sessionId)
    if (s) s.state.anim = ANIM.idle
    this.allowReconnection(client, RECONNECT_SECONDS)
  }

  onReconnect(client: Client): void {
    const s = this.sessions.get(client.sessionId)
    if (!s) return
    s.client = client
    this.sendWelcome(s)
  }

  async onLeave(client: Client): Promise<void> {
    const s = this.sessions.get(client.sessionId)
    if (!s) return
    s.respawnTimer?.clear()
    this.sessions.delete(client.sessionId)
    this.state.players.delete(client.sessionId)
    s.data.lastSeen = Date.now()
    if (activeSessions.get(s.data.id)?.sessionId === client.sessionId) activeSessions.delete(s.data.id)
    await players.release(s.data.id)
  }

  onDispose(): void {
    this.unsubscribeBoards?.()
  }

  /* -------------------------------------------------------------------------
   * Messaging helpers
   * ----------------------------------------------------------------------- */

  private sendWelcome(s: PlayerSession): void {
    s.client.send(S2C.welcome, {
      serverNow: Date.now(),
      data: s.data,
      publicId: s.publicId,
      run: s.runState(),
      leaderboards: leaderboards.latest,
      roomId: this.roomId,
    })
    s.syncDirty = false
  }

  private sendSelf(s: PlayerSession): void {
    s.client.send(S2C.self, { serverNow: Date.now(), data: s.data, publicId: s.publicId })
    s.syncDirty = false
  }

  private sendRun(s: PlayerSession): void {
    s.client.send(S2C.run, s.runState())
  }

  private error(s: PlayerSession, code: ErrorCode): void {
    s.client.send(S2C.error, { code })
  }

  private reward(s: PlayerSession, source: RewardSource, title: string, reward: RewardSummary): void {
    s.client.send(S2C.reward, { source, title, reward })
  }

  private teleport(s: PlayerSession, x: number, z: number, rotY: number): void {
    s.pos.x = x
    s.pos.y = 0
    s.pos.z = z
    s.pos.rotY = rotY
    s.state.x = x
    s.state.y = 0
    s.state.z = z
    s.state.rotY = rotY
    s.state.stage = inCorridor(z) ? s.run.stage : 0
    s.teleportUntil = Date.now() + 1000
    s.client.send(S2C.teleport, { x, z, rotY })
  }

  /** Persist soon (coalesced), for purchases and other important changes. */
  private markSave(s: PlayerSession): void {
    s.saveDirty = true
    if (s.saveScheduled) return
    s.saveScheduled = true
    this.clock.setTimeout(() => {
      s.saveScheduled = false
      if (!s.saveDirty || !this.sessions.has(s.client.sessionId)) return
      s.saveDirty = false
      void players.save(s.data)
    }, 1000)
  }

  /** After any economy change: push it to the owner, the room and the store. */
  private changed(s: PlayerSession): void {
    this.tutorial(s)
    this.awardBadges(s)
    this.syncPublic(s)
    this.sendSelf(s)
    this.markSave(s)
  }

  /** Mirrors the public parts of PlayerData into the synced PlayerState. */
  private syncPublic(s: PlayerSession): void {
    const d = s.data
    const ps = s.state
    ps.boomerang = bestBoomerangId(d)
    ps.vip = d.vipBoomerang
    ps.trail = d.equippedTrail
    ps.rebirths = d.rebirths
    ps.level = playerLevel(d)
    const pets = equippedPetInstances(d).map((p) => encodePublicPet(p, rarityIndex(p.rarity)))
    const same = pets.length === ps.pets.length && pets.every((p, i) => ps.pets[i] === p)
    if (!same) {
      ps.pets.clear()
      for (const p of pets) ps.pets.push(p)
    }
  }

  private tutorial(s: PlayerSession): void {
    if (advanceTutorial(s.data, s.run)) s.syncDirty = true
  }

  private awardBadges(s: PlayerSession): void {
    for (const id of checkBadges(s.data)) {
      s.client.send(S2C.badge, { id })
      s.syncDirty = true
    }
  }

  private checkLevelUp(s: PlayerSession): void {
    const level = playerLevel(s.data)
    if (level > s.level) {
      s.level = level
      s.state.level = level
      s.client.send(S2C.levelUp, { level })
    }
  }

  private friendsInRoom(s: PlayerSession): number {
    if (s.data.friends.length === 0) return 0
    let n = 0
    for (const other of this.sessions.values()) {
      if (other !== s && s.data.friends.includes(other.publicId)) n += 1
    }
    return n
  }

  private near(s: PlayerSession, spot: { x: number; z: number }, radius: number): boolean {
    return distance2D(s.pos, spot) <= radius + INTERACT_TOLERANCE
  }

  /** Registers a handler that receives the sender's session; errors never escape. */
  private on<T>(type: string, fn: (s: PlayerSession, msg: T) => void): void {
    this.onMessage(type, (client: Client, msg: T) => {
      const s = this.sessions.get(client.sessionId)
      if (!s) return
      try {
        fn(s, msg)
      } catch (err) {
        console.error(`[room] ${type} failed for ${s.data.name}`, err)
        this.error(s, 'bad_request')
      }
    })
  }

  /* -------------------------------------------------------------------------
   * Handlers
   * ----------------------------------------------------------------------- */

  private registerHandlers(): void {
    this.on<MoveMsg>(C2S.move, (s, m) => this.handleMove(s, m))
    this.on<ThrowMsg>(C2S.throw, (s, m) => this.handleThrow(s, m))

    this.on(C2S.claimPad, (s) => {
      if (!onWinPad(s.pos, s.run.stage)) return this.error(s, 'too_far')
      const r = claimPad(s.data, s.run, Date.now())
      if (!r.ok) return this.error(s, r.error)
      s.client.send(S2C.padClaimed, { stage: s.run.stage, wins: r.wins, unlocked: r.unlocked })
      this.sendRun(s)
      this.changed(s)
      // After a short celebration: back to the lobby, lined up for the next stage.
      s.respawnTimer?.clear()
      s.respawnTimer = this.clock.setTimeout(() => {
        s.respawnTimer = null
        const stage = s.run.stage
        s.run = createRun(stage < STAGE_COUNT && isStageUnlocked(s.data, stage + 1) ? stage + 1 : stage)
        this.teleport(s, SPAWN.x, SPAWN.z, SPAWN.rotY)
        this.sendRun(s)
      }, PAD_RESPAWN_MS)
    })

    this.on<{ stage: number }>(C2S.teleportStage, (s, m) => {
      const stage = Math.floor(Number(m?.stage))
      if (!finite(stage)) return this.error(s, 'bad_request')
      s.respawnTimer?.clear()
      s.respawnTimer = null
      if (stage === 0) {
        if (s.run.padClaimed) s.run = createRun(s.run.stage)
        this.teleport(s, SPAWN.x, SPAWN.z, SPAWN.rotY)
        this.sendRun(s)
        return
      }
      if (!isStageUnlocked(s.data, stage)) return this.error(s, 'stage_locked')
      s.run = createRun(stage)
      const spawn = stageSpawn(stage)
      this.teleport(s, spawn.x, spawn.z, spawn.rotY)
      this.sendRun(s)
    })

    this.on<{ pad: number }>(C2S.teleportPad, (s, m) => {
      const pad = Math.floor(Number(m?.pad))
      const spot = TRAINING_PAD_SPOTS[pad]
      if (!spot) return this.error(s, 'bad_request')
      if (!isPadUnlocked(pad, s.data.rebirths)) return this.error(s, 'not_owned')
      // Face the dummy, which stands to the -X side of its pad.
      this.teleport(s, spot.pad.x, spot.pad.z, -Math.PI / 2)
    })

    this.on(C2S.buyBoomerang, (s) => {
      const r = buyNextBoomerang(s.data)
      if (!r.ok) return this.error(s, r.error)
      s.client.send(S2C.purchase, { kind: 'boomerang', id: r.id })
      this.changed(s)
    })

    this.on<{ id: number }>(C2S.buyTrail, (s, m) => {
      const r = buyTrail(s.data, Math.floor(Number(m?.id)))
      if (!r.ok) return this.error(s, r.error)
      s.client.send(S2C.purchase, { kind: 'trail', id: r.id })
      this.changed(s)
    })

    this.on<{ id: number }>(C2S.equipTrail, (s, m) => {
      const r = equipTrail(s.data, Math.floor(Number(m?.id)))
      if (!r.ok) return this.error(s, r.error)
      this.changed(s)
    })

    this.on(C2S.rebirth, (s) => {
      const r = rebirth(s.data)
      if (!r.ok) return this.error(s, r.error)
      s.respawnTimer?.clear()
      s.respawnTimer = null
      s.run = createRun(1)
      this.teleport(s, SPAWN.x, SPAWN.z, SPAWN.rotY)
      this.sendRun(s)
      s.client.send(S2C.rebirthDone, { rebirths: r.rebirths })
      this.changed(s)
    })

    this.on<OpenEggMsg>(C2S.openEgg, (s, m) => {
      const eggIndex = EGGS.findIndex((e) => e.id === m?.egg)
      if (eggIndex < 0) return this.error(s, 'not_found')
      if (!this.near(s, EGG_SPOTS[eggIndex], INTERACT_RADIUS)) return this.error(s, 'too_far')
      const count = m.count === 3 ? 3 : 1
      const r = openEgg(s.data, m.egg, count, Math.random)
      if (!r.ok) return this.error(s, r.error)
      s.client.send(S2C.eggResult, { egg: m.egg, pets: r.pets, vip: r.vip, free: false })
      this.changed(s)
    })

    this.on<{ uid: string }>(C2S.equipPet, (s, m) => {
      const r = equipPet(s.data, String(m?.uid))
      if (!r.ok) return this.error(s, r.error)
      this.changed(s)
    })
    this.on<{ uid: string }>(C2S.unequipPet, (s, m) => {
      unequipPet(s.data, String(m?.uid))
      this.changed(s)
    })
    this.on(C2S.equipBestPets, (s) => {
      equipBestPets(s.data)
      this.changed(s)
    })
    this.on<{ petId: string; rarity: Rarity }>(C2S.mergePets, (s, m) => {
      if (!RARITIES.includes(m?.rarity)) return this.error(s, 'bad_request')
      const r = mergePets(s.data, String(m.petId), m.rarity)
      if (!r.ok) return this.error(s, r.error)
      this.changed(s)
    })
    this.on<{ uid: string }>(C2S.deletePet, (s, m) => {
      const r = deletePet(s.data, String(m?.uid))
      if (!r.ok) return this.error(s, r.error)
      this.changed(s)
    })

    this.on<{ index: number }>(C2S.claimGift, (s, m) => {
      const index = Math.floor(Number(m?.index))
      const r = claimGift(s.data, index, Date.now())
      if (!r.ok) return this.error(s, r.error)
      this.reward(s, 'gift', `${PLAYTIME_GIFTS[index].minutes} Minute Gift`, r.reward)
      this.changed(s)
    })

    this.on(C2S.claimDaily, (s) => {
      const r = claimDaily(s.data, Date.now())
      if (!r.ok) return this.error(s, r.error)
      this.reward(s, 'daily', `Day ${r.day} Reward`, r.reward)
      this.changed(s)
    })

    this.on<{ id: string }>(C2S.claimQuest, (s, m) => {
      const id = String(m?.id)
      const r = claimQuest(s.data, id, Date.now())
      if (!r.ok) return this.error(s, r.error)
      this.reward(s, 'quest', questDef(id)?.title ?? 'Quest', r.reward)
      this.changed(s)
    })

    this.on<{ code: string }>(C2S.redeemCode, (s, m) => {
      const r = redeemCode(s.data, String(m?.code ?? ''), Date.now())
      if (!r.ok) return this.error(s, r.error)
      this.reward(s, 'code', `Code ${r.code}`, r.reward)
      this.changed(s)
    })

    this.on<{ item: PerkId }>(C2S.buyPerk, (s, m) => {
      const item = m?.item
      if (!item || !(item in PERK_SHOP)) return this.error(s, 'not_found')
      const r = buyPerk(s.data, item, Date.now())
      if (!r.ok) return this.error(s, r.error)
      s.client.send(S2C.purchase, { kind: 'perk', id: item })
      if (r.reward) this.reward(s, 'perk', PERK_SHOP[item].name, r.reward)
      this.changed(s)
    })

    this.on(C2S.claimLuckyBlock, (s) => this.handleLuckyClaim(s))

    this.on<{ index: number }>(C2S.collectPumpkin, (s, m) => {
      const index = Math.floor(Number(m?.index))
      const spot = PUMPKIN_SPOTS[index]
      if (!spot) return this.error(s, 'bad_request')
      if (!this.near(s, spot, HALLOWEEN.pickupRadius)) return this.error(s, 'too_far')
      const r = collectPumpkin(s.data, index, Date.now())
      if (!r.ok) return // Already collected: the client will catch up on the next sync.
      this.changed(s)
    })

    this.on<{ pid: string }>(C2S.addFriend, (s, m) => {
      const pid = String(m?.pid ?? '')
      const inRoom = [...this.sessions.values()].some((o) => o.publicId === pid)
      if (!inRoom) return this.error(s, 'not_found')
      const r = addFriend(s.data, pid)
      if (!r.ok) return this.error(s, r.error)
      this.changed(s)
    })

    this.on<{ pid: string }>(C2S.removeFriend, (s, m) => {
      removeFriend(s.data, String(m?.pid ?? ''))
      this.changed(s)
    })

    this.on<{ look: unknown }>(C2S.setAvatar, (s, m) => {
      const look = sanitizeAvatarLook(m?.look)
      const ps = this.state.players.get(s.client.sessionId)
      if (ps && ps.avatar !== look && look.length <= 1024) ps.avatar = look
    })

    this.on<{ name: string }>(C2S.setName, (s, m) => {
      const name = sanitizeName(m?.name)
      if (!name) return this.error(s, 'bad_request')
      s.data.name = name
      s.state.name = name
      this.changed(s)
    })

    this.on(C2S.rollTutorialReward, (s) => {
      const r = rollTutorialReward(s.data, Math.random, Date.now())
      if (!r.ok) return this.error(s, r.error)
      s.client.send(S2C.tutorialReward, { index: r.index })
      this.changed(s)
    })

    this.on(C2S.requestSync, (s) => {
      this.sendSelf(s)
      this.sendRun(s)
    })
  }

  private handleMove(s: PlayerSession, m: MoveMsg): void {
    if (!m || !finite(m.x, m.y, m.z, m.r, m.a)) return
    const now = Date.now()
    // After a server teleport, drop stale positions sent before the client applied it.
    if (now < s.teleportUntil && Math.hypot(m.x - s.pos.x, m.z - s.pos.z) > 3) return

    const dt = clamp((now - s.lastMoveAt) / 1000, 0.05, 1.5)
    s.lastMoveAt = now
    const c = constrainPosition(m.x, m.z, s.run)
    const maxStep = MAX_SPEED * levelSpeedMult(s.level) * dt * 1.6 + 1.5
    if (Math.hypot(c.x - s.pos.x, c.z - s.pos.z) > maxStep) {
      // Faster than anyone can run: rubber-band back to the last good position.
      this.teleport(s, s.pos.x, s.pos.z, s.pos.rotY)
      return
    }

    const corrected = Math.hypot(c.x - m.x, c.z - m.z) > CORRECTION_DISTANCE
    s.pos.x = c.x
    s.pos.z = c.z
    s.pos.y = clamp(m.y, 0, 12)
    s.pos.rotY = m.r
    const ps = s.state
    ps.x = c.x
    ps.y = s.pos.y
    ps.z = c.z
    ps.rotY = m.r
    ps.anim = clamp(Math.floor(m.a), 0, ANIM.jump)
    ps.stage = inCorridor(c.z) ? s.run.stage : 0
    if (corrected) this.teleport(s, c.x, c.z, m.r)
  }

  private handleThrow(s: PlayerSession, m: ThrowMsg): void {
    const now = Date.now()
    if (!s.throws.take(now)) return
    const d = s.data
    let padId = padAtPosition(s.pos)
    if (padId >= 0 && !isPadUnlocked(padId, d.rebirths)) padId = -1

    const gain = applyThrowGain(d, { padId, friendsInRoom: this.friendsInRoom(s), now })
    const result: ThrowResultMsg = { s: Number(m?.s) || 0, g: gain, p: d.power, t: TARGET.none }

    if (padId >= 0) {
      result.t = TARGET.dummy
      result.pad = padId
    } else if (inCorridor(s.pos.z) && s.run.wallsBroken < WALLS_PER_STAGE) {
      // Only the active stage's next wall, and only when it is in front and in reach.
      const distance = s.pos.z - wallZ(s.run.stage, s.run.wallsBroken + 1)
      if (distance >= -1 && distance <= THROW.range + RANGE_TOLERANCE) {
        const wall = s.run.wallsBroken + 1
        const hit = hitWall(d, s.run, d.power, now)
        result.t = TARGET.wall
        result.hit = { damage: hit.damage, broken: hit.broken, winsGained: hit.winsGained, wall }
        result.run = s.runState()
        result.w = d.wins
        if (hit.broken) s.syncDirty = true
      }
    }

    s.state.throws = (s.state.throws + 1) & 0xffff
    s.saveDirty = true
    s.syncDirty = true
    s.client.send(S2C.throwResult, result)
    this.checkLevelUp(s)
    if (advanceTutorial(d, s.run)) this.sendSelf(s)
    this.awardBadges(s)
  }

  private handleLuckyClaim(s: PlayerSession): void {
    const lucky = this.state.lucky
    if (lucky.phase !== LUCKY_PHASE.active) return this.error(s, 'not_ready')
    if (!this.near(s, { x: lucky.x, z: lucky.z }, LUCKY_BLOCK.touchRadius)) return this.error(s, 'too_far')

    lucky.phase = LUCKY_PHASE.countdown
    lucky.secondsLeft = LUCKY_BLOCK.intervalSeconds

    // Pets only come from the Halloween Egg: a Lucky Block pays Wins and a boost,
    // with a small chance at the VIP boomerang.
    const reward = grantLuckyReward(s.data, Math.random, Date.now())
    this.reward(s, 'lucky', 'Lucky Block!', reward)
    this.broadcast(S2C.luckyWinner, { name: s.data.name, petName: '', rarity: null, vip: reward.vip })
    this.changed(s)
  }

  /* -------------------------------------------------------------------------
   * Timers
   * ----------------------------------------------------------------------- */

  private tickSecond(): void {
    const now = Date.now()
    for (const s of this.sessions.values()) {
      const before = s.data.playtime.day
      addPlaytime(s.data, 1, now)
      if (s.data.playtime.day !== before) s.syncDirty = true
      // A gift just became claimable: tell the client so its badge lights up.
      for (const gift of PLAYTIME_GIFTS) {
        if (s.data.playtime.seconds === gift.minutes * 60) s.syncDirty = true
      }
    }

    const lucky = this.state.lucky
    if (lucky.secondsLeft > 0) lucky.secondsLeft -= 1
    if (lucky.secondsLeft === 0) {
      if (lucky.phase === LUCKY_PHASE.countdown) {
        const spot = LUCKY_SPOTS[Math.floor(Math.random() * LUCKY_SPOTS.length)]
        lucky.x = spot.x
        lucky.z = spot.z
        lucky.phase = LUCKY_PHASE.active
        lucky.secondsLeft = LUCKY_BLOCK.activeSeconds
      } else {
        lucky.phase = LUCKY_PHASE.countdown
        lucky.secondsLeft = LUCKY_BLOCK.intervalSeconds
      }
    }
  }

  private flushSync(): void {
    for (const s of this.sessions.values()) if (s.syncDirty) this.sendSelf(s)
  }

  private autosave(): void {
    const now = Date.now()
    for (const s of this.sessions.values()) {
      if (!s.saveDirty) continue
      s.saveDirty = false
      s.data.lastSeen = now
      void players.save(s.data)
    }
  }
}
