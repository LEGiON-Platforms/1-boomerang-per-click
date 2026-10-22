import { Vector3 } from 'three'

/**
 * Other players in the room, fed by Colyseus state callbacks and read by the
 * renderers every frame. Positions are buffered and drawn ~120 ms in the past so
 * 10 Hz updates interpolate smoothly.
 */

export const SNAPSHOTS = 16
export const INTERP_DELAY_MS = 120

export interface RemotePlayer {
  sessionId: string
  name: string
  pid: string
  /** Ring buffer of timestamped poses. */
  t: Float64Array
  x: Float32Array
  y: Float32Array
  z: Float32Array
  r: Float32Array
  head: number
  count: number
  anim: number
  boomerang: number
  vip: boolean
  trail: number
  level: number
  rebirths: number
  pets: string[]
  /** Bloxity look as relayed JSON (see AvatarLook). */
  avatar: string
  /** Drawn as a full Bloxity avatar this frame (chosen by the logic tick). */
  full: boolean
  /** Right-hand world position from the full avatar's rig (valid when handAt is recent). */
  hand: Vector3
  handAt: number
  /** Clock time (s) of this player's last throw, for the animation. */
  throwAt: number
  /** Interpolated pose, written by RemotePlayers each frame. */
  px: number
  py: number
  pz: number
  prot: number
  /** Walk-cycle phase, advanced by the renderer. */
  walkPhase: number
  speed: number
}

export const remotePlayers = new Map<string, RemotePlayer>()
/** Same players as an array, so frame loops iterate without allocating iterators. */
export const remoteList: RemotePlayer[] = []

export function addRemote(p: RemotePlayer): void {
  removeRemote(p.sessionId)
  remotePlayers.set(p.sessionId, p)
  remoteList.push(p)
}

export function removeRemote(sessionId: string): void {
  remotePlayers.delete(sessionId)
  const i = remoteList.findIndex((r) => r.sessionId === sessionId)
  if (i >= 0) remoteList.splice(i, 1)
}

export function clearRemotes(): void {
  remotePlayers.clear()
  remoteList.length = 0
}

export function createRemote(sessionId: string, name: string, pid: string, x: number, y: number, z: number, r: number): RemotePlayer {
  const p: RemotePlayer = {
    sessionId,
    name,
    pid,
    t: new Float64Array(SNAPSHOTS),
    x: new Float32Array(SNAPSHOTS),
    y: new Float32Array(SNAPSHOTS),
    z: new Float32Array(SNAPSHOTS),
    r: new Float32Array(SNAPSHOTS),
    head: 0,
    count: 0,
    anim: 0,
    boomerang: 0,
    vip: false,
    trail: 0,
    level: 1,
    rebirths: 0,
    pets: [],
    avatar: '',
    full: false,
    hand: new Vector3(),
    handAt: -10,
    throwAt: -10,
    px: x,
    py: y,
    pz: z,
    prot: r,
    walkPhase: 0,
    speed: 0,
  }
  pushSnapshot(p, x, y, z, r)
  return p
}

export function pushSnapshot(p: RemotePlayer, x: number, y: number, z: number, r: number): void {
  p.head = (p.head + 1) % SNAPSHOTS
  p.t[p.head] = performance.now()
  p.x[p.head] = x
  p.y[p.head] = y
  p.z[p.head] = z
  p.r[p.head] = r
  p.count = Math.min(p.count + 1, SNAPSHOTS)
}

const lerpAngle = (a: number, b: number, t: number) => {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

/** Writes the interpolated pose for render time `nowMs` into p.px/py/pz/prot. */
export function sampleRemote(p: RemotePlayer, nowMs: number): void {
  const target = nowMs - INTERP_DELAY_MS
  // Walk back from the newest snapshot to find the pair around `target`.
  let newer = p.head
  for (let k = 0; k < p.count - 1; k += 1) {
    const older = (newer - 1 + SNAPSHOTS) % SNAPSHOTS
    if (p.t[older] <= target) {
      const span = p.t[newer] - p.t[older] || 1
      const a = Math.min(1, Math.max(0, (target - p.t[older]) / span))
      p.px = p.x[older] + (p.x[newer] - p.x[older]) * a
      p.py = p.y[older] + (p.y[newer] - p.y[older]) * a
      p.pz = p.z[older] + (p.z[newer] - p.z[older]) * a
      p.prot = lerpAngle(p.r[older], p.r[newer], a)
      return
    }
    newer = older
  }
  // Not enough history yet: use the newest pose.
  p.px = p.x[p.head]
  p.py = p.y[p.head]
  p.pz = p.z[p.head]
  p.prot = p.r[p.head]
}
