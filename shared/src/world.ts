/**
 * World layout and movement rules, shared so the server can validate the exact
 * positions the client is allowed to reach.
 *
 * Axes: +X right, +Y up, -Z is "forward" from spawn into the stage corridor.
 * The lobby is the rectangle at z >= 0; the corridor runs from z = 0 to negative z.
 */

import { STAGE_COUNT, WALLS_PER_STAGE } from './config/economy'

export interface Vec2 {
  x: number
  z: number
}

export const PLAYER_RADIUS = 0.45
export const MOVE_SPEED = 6
export const SPRINT_MULT = 1.6
export const MAX_SPEED = MOVE_SPEED * SPRINT_MULT
export const JUMP_VELOCITY = 8.5
export const GRAVITY = 24

/* ---------------------------------------------------------------------------
 * Lobby
 * ------------------------------------------------------------------------- */

export const LOBBY = { minX: -44, maxX: 44, minZ: 0, maxZ: 70 } as const
/** rotY = PI faces -Z, towards the stage gate. */
export const SPAWN = { x: 0, z: 26, rotY: Math.PI } as const

/** Training pads: the player stands on `pad`, the dummy stands at `dummy`. */
export const TRAINING_PAD_SPOTS: readonly { pad: Vec2; dummy: Vec2 }[] = [8, 15, 22, 29, 36, 43, 50].map(
  (z) => ({ pad: { x: -30, z }, dummy: { x: -38, z } }),
)
export const TRAINING_PAD_RADIUS = 2.2

/**
 * Boomerang Stage (east side): a low two-tier platform showing the boomerangs in
 * order — Boomerangs 1–10 along the front tier, 11–20 along the higher back tier
 * (staggered, so both rows read from the lobby). Each stands over a buy pad; the
 * VIP boomerang has a podium at the north end. Walkable: see groundHeight.
 */
export const BOOMERANG_STAGE = {
  minX: 31,
  maxX: LOBBY.maxX,
  minZ: 2,
  maxZ: 58,
  /** The back tier starts at this x. */
  backX: 37.5,
  frontHeight: 0.6,
  backHeight: 1.2,
  perRow: 10,
  /** z of the first front-row pad, and the gap between pads in a row. */
  firstZ: 12,
  spacing: 4.6,
  padRadius: 1.2,
} as const

/** The tallest ledge the player walks up without jumping. */
export const STEP_UP = 0.8

export interface Vec3 extends Vec2 {
  y: number
}

/** Centre of each display pad, on its tier: the front row, then the (staggered) back row. */
export const BOOMERANG_SPOTS: readonly Vec3[] = Array.from({ length: BOOMERANG_STAGE.perRow * 2 }, (_, i) => {
  const s = BOOMERANG_STAGE
  const back = i >= s.perRow
  const k = i % s.perRow
  return back
    ? { x: (s.backX + s.maxX) / 2, y: s.backHeight, z: s.firstZ + (k + 0.5) * s.spacing }
    : { x: (s.minX + s.backX) / 2, y: s.frontHeight, z: s.firstZ + k * s.spacing }
})

/** The VIP boomerang's podium, at the north end of the stage. */
export const VIP_DISPLAY: Vec3 = {
  x: BOOMERANG_STAGE.backX,
  y: BOOMERANG_STAGE.backHeight,
  z: (BOOMERANG_STAGE.minZ + BOOMERANG_STAGE.firstZ - BOOMERANG_STAGE.padRadius) / 2,
}

/** Floor height at (x, z): the stage's tiers, 0 everywhere else. */
export function groundHeight(x: number, z: number): number {
  const s = BOOMERANG_STAGE
  if (x < s.minX || x > s.maxX || z < s.minZ || z > s.maxZ) return 0
  return x < s.backX ? s.frontHeight : s.backHeight
}

/** Index of the display pad under (x, z), or -1. */
export function boomerangPadAt(p: Vec2): number {
  for (let i = 0; i < BOOMERANG_SPOTS.length; i += 1) {
    const s = BOOMERANG_SPOTS[i]
    if (Math.hypot(p.x - s.x, p.z - s.z) < BOOMERANG_STAGE.padRadius) return i
  }
  return -1
}

/** Eggs, in EGGS order: the Halloween Egg, at the front right of the stage gate. */
export const EGG_SPOTS: readonly Vec2[] = [{ x: 15, z: 9 }]

export const TRAILS_STALL: Vec2 = { x: -15, z: 9 }
export const REBIRTH_STATUE: Vec2 = { x: 16, z: 40 }
export const LEADERBOARD_SPOTS: readonly Vec2[] = [
  { x: -18, z: 69 },
  { x: 0, z: 69 },
  { x: 18, z: 69 },
]
export const LIKE_BOARD: Vec2 = { x: -34, z: 64 }
export const INVITE_BOARD: Vec2 = { x: -24, z: 18 }

/** How close (world units) the player must be to interact with lobby objects. */
export const INTERACT_RADIUS = 4.5
/** Server-side tolerance on top of INTERACT_RADIUS for latency. */
export const INTERACT_TOLERANCE = 3

export interface Box {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

const box = (c: Vec2, hx: number, hz: number): Box => ({
  minX: c.x - hx,
  maxX: c.x + hx,
  minZ: c.z - hz,
  maxZ: c.z + hz,
})

/** Raised deck the training dummies stand on (west side). */
export const TRAINING_DECK: Box = { minX: LOBBY.minX, maxX: -35, minZ: 3, maxZ: 55 }

/** Solid lobby props the player collides with. (The Boomerang Stage is walkable: see groundHeight.) */
export const LOBBY_OBSTACLES: readonly Box[] = [
  TRAINING_DECK,
  ...EGG_SPOTS.map((e) => box(e, 1.5, 1.5)),
  box(TRAILS_STALL, 3.2, 1.6),
  box(REBIRTH_STATUE, 1.8, 1.8),
]

/* ---------------------------------------------------------------------------
 * Stage corridor
 * ------------------------------------------------------------------------- */

export const CORRIDOR = {
  halfWidth: 8,
  /** Height of the cliff walls either side. */
  cliffHeight: 14,
} as const

export const STAGE_LENGTH = 80
export const WALL_SPACING = 6
export const FIRST_WALL_OFFSET = 10
export const WALL_THICKNESS = 1.2
export const WALL_HEIGHT = 10

/**
 * Past its last wall each stage opens into a wider reward room that runs to the
 * end gate; the win pad sits against the room's left wall (facing down the
 * corridor, left is -x).
 */
export const REWARD_ROOM = {
  /** Distance from the stage entrance to where the room opens (just past wall 10). */
  startOffset: 67,
  halfWidth: 13,
} as const
export const PAD_OFFSET = 75
export const PAD_SIZE = { w: 6, d: 6 } as const
export const PAD_X = -(REWARD_ROOM.halfWidth - PAD_SIZE.w / 2 - 0.5)

/**
 * The stages run one after another down a single line behind the lobby gate:
 * stage 1's walls and reward room, then the gate into stage 2, and so on.
 */
export const CORRIDOR_START_Z = -4

/** z of the entrance line of a stage. */
export function stageStartZ(stage: number): number {
  return CORRIDOR_START_Z - (stage - 1) * STAGE_LENGTH
}

/** z of wall `wall` (1..10) of `stage`. */
export function wallZ(stage: number, wall: number): number {
  return stageStartZ(stage) - FIRST_WALL_OFFSET - (wall - 1) * WALL_SPACING
}

export function padZ(stage: number): number {
  return stageStartZ(stage) - PAD_OFFSET
}

/** The gate at the end of `stage`'s reward room, which is also the entrance of `stage + 1`. */
export function gateZ(stage: number): number {
  return stageStartZ(stage + 1)
}

/** Where a teleport into `stage` lands the player. */
export function stageSpawn(stage: number): { x: number; z: number; rotY: number } {
  return { x: 0, z: stageStartZ(stage) - 2, rotY: Math.PI }
}

/** How far past its stage's entrance `z` lies (0..STAGE_LENGTH); negative in the lobby. */
function depthIntoStage(z: number): number {
  const d = CORRIDOR_START_Z - z
  return d < 0 ? d : d % STAGE_LENGTH
}

/** Whether `z` lies inside some stage's reward room. */
export function inRewardRoom(z: number): boolean {
  return depthIntoStage(z) >= REWARD_ROOM.startOffset
}

/** Which stage area `z` lies in; 0 for the lobby. */
export function stageAtZ(z: number): number {
  if (z > CORRIDOR_START_Z) return 0
  const s = Math.floor((CORRIDOR_START_Z - z) / STAGE_LENGTH) + 1
  return Math.min(Math.max(s, 1), STAGE_COUNT)
}

/** Lucky block drop spots: around the lobby plus the entrance area of early stages. */
export const LUCKY_SPOTS: readonly Vec2[] = [
  { x: -8, z: 36 },
  { x: 10, z: 50 },
  { x: -20, z: 34 },
  { x: 22, z: 20 },
  { x: -34, z: 56 },
  { x: 27, z: 54 },
  { x: 0, z: 12 },
  { x: -6, z: 46 },
  ...[1, 2, 3, 4, 5].map((s) => ({ x: s % 2 === 0 ? 4 : -4, z: stageStartZ(s) - 5 })),
]

/** Halloween pumpkin spawn points: scattered over the lobby, one per stage entrance. */
export const PUMPKIN_SPOTS: readonly Vec2[] = [
  { x: -6, z: 32 },
  { x: 8, z: 18 },
  { x: -20, z: 26 },
  { x: 22, z: 30 },
  { x: -34, z: 4 },
  { x: 27, z: 6 },
  { x: -10, z: 48 },
  { x: 8, z: 46 },
  { x: -30, z: 60 },
  { x: 28, z: 62 },
  { x: 0, z: 40 },
  { x: -26, z: 40 },
  ...Array.from({ length: STAGE_COUNT }, (_, i) => ({ x: (i % 3) * 5 - 5, z: stageStartZ(i + 1) - 6 })),
]

/* ---------------------------------------------------------------------------
 * Movement constraints
 * ------------------------------------------------------------------------- */

/**
 * The stage run decides how far down the line the player may go: up to the next
 * unbroken wall of the active stage. Once its 10 walls are down the next stage is
 * unlocked and its gate stands open, so the limit becomes that stage's first wall
 * (the final stage's gate stays shut).
 */
export interface RunBarrier {
  stage: number
  /** Walls broken so far in the active stage (0..10). */
  wallsBroken: number
}

/** The most-negative z the player's centre may reach. */
export function barrierMinZ(run: RunBarrier): number {
  const blockZ =
    run.wallsBroken < WALLS_PER_STAGE
      ? wallZ(run.stage, run.wallsBroken + 1)
      : run.stage < STAGE_COUNT
        ? wallZ(run.stage + 1, 1)
        : gateZ(run.stage)
  return blockZ + WALL_THICKNESS / 2 + PLAYER_RADIUS
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

const WALKABLE_LOBBY: Box = {
  minX: LOBBY.minX + PLAYER_RADIUS,
  maxX: LOBBY.maxX - PLAYER_RADIUS,
  minZ: LOBBY.minZ + PLAYER_RADIUS,
  maxZ: LOBBY.maxZ - PLAYER_RADIUS,
}

const _out: Vec2 = { x: 0, z: 0 }

/**
 * Constrains a desired position to the walkable area (lobby ∪ corridor up to the
 * barrier), then pushes it out of solid props. Writes into and returns a shared
 * scratch object — copy the fields if you need to keep them.
 */
export function constrainPosition(x: number, z: number, run: RunBarrier): Vec2 {
  const r = PLAYER_RADIUS

  const ax = clamp(x, WALKABLE_LOBBY.minX, WALKABLE_LOBBY.maxX)
  const az = clamp(z, WALKABLE_LOBBY.minZ, WALKABLE_LOBBY.maxZ)
  // The corridor overlaps the lobby by a little so the two regions connect.
  let bz = clamp(z, barrierMinZ(run), LOBBY.minZ + r + 1)
  const narrow = CORRIDOR.halfWidth - r
  if (Math.abs(x) > narrow && !inRewardRoom(bz)) {
    // Beside the narrow corridor is only open inside a reward room: step back to
    // the room's edge if that's the shorter way out, else slide along the corridor wall.
    const depth = depthIntoStage(bz)
    const toRoomStart = REWARD_ROOM.startOffset - depth + r
    const toRoomEnd = stageAtZ(bz) > 1 ? depth + r : Infinity
    const dx = Math.abs(x) - narrow
    if (Math.min(toRoomStart, toRoomEnd) < dx) {
      bz = toRoomStart <= toRoomEnd ? bz - toRoomStart : bz + toRoomEnd
      bz = Math.max(bz, barrierMinZ(run))
    }
  }
  const halfWidth = inRewardRoom(bz) ? REWARD_ROOM.halfWidth - r : narrow
  const bx = clamp(x, -halfWidth, halfWidth)

  const da = (ax - x) ** 2 + (az - z) ** 2
  const db = (bx - x) ** 2 + (bz - z) ** 2
  let px = da <= db ? ax : bx
  let pz = da <= db ? az : bz

  if (pz > 0) {
    for (const o of LOBBY_OBSTACLES) {
      const minX = o.minX - r
      const maxX = o.maxX + r
      const minZ = o.minZ - r
      const maxZ = o.maxZ + r
      if (px <= minX || px >= maxX || pz <= minZ || pz >= maxZ) continue
      // Push out along the shallowest axis.
      const left = px - minX
      const right = maxX - px
      const near = pz - minZ
      const far = maxZ - pz
      const m = Math.min(left, right, near, far)
      if (m === left) px = minX
      else if (m === right) px = maxX
      else if (m === near) pz = minZ
      else pz = maxZ
    }
  }

  _out.x = px
  _out.z = pz
  return _out
}

export function distance2D(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/** Training pad the position stands on, or -1. */
export function padAtPosition(p: Vec2): number {
  for (let i = 0; i < TRAINING_PAD_SPOTS.length; i += 1) {
    if (distance2D(p, TRAINING_PAD_SPOTS[i].pad) <= TRAINING_PAD_RADIUS) return i
  }
  return -1
}

/** True when standing on the Win Pad of `stage`. */
export function onWinPad(p: Vec2, stage: number): boolean {
  return (
    Math.abs(p.x - PAD_X) <= PAD_SIZE.w / 2 + PLAYER_RADIUS &&
    Math.abs(p.z - padZ(stage)) <= PAD_SIZE.d / 2 + PLAYER_RADIUS
  )
}
