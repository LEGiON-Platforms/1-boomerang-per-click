import { ANIM, SPAWN, type TeleportMsg } from '@game/shared'
import { type Camera, Vector3 } from 'three'

/**
 * Mutable per-frame game state. Deliberately *not* React/zustand state: it changes
 * every frame and is read inside useFrame loops, where re-rendering is forbidden.
 */

export const localPlayer = {
  pos: new Vector3(SPAWN.x, 0, SPAWN.z),
  velY: 0,
  /** Facing (radians); rotY = PI looks down -Z. */
  rotY: SPAWN.rotY as number,
  speed: 0,
  grounded: true,
  anim: ANIM.idle as number,
  /** Clock time (s) of the last throw, for the arm swing. */
  throwAt: -10,
  /** Face this yaw while throwing in place (null = face movement). */
  aimYaw: null as number | null,
  /** Seconds the aim yaw stays locked after a throw. */
  aimUntil: 0,
  /** Walk/run speed bonus from the player's level (set by the logic tick). */
  speedMult: 1,
}

export const input = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
  /** Virtual joystick, -1..1 (y up = forward). */
  joyX: 0,
  joyY: 0,
}

export const cameraState = {
  yaw: 0,
  pitch: 0.32,
  distance: 9,
  /** Screen-shake strength, decays every frame. */
  shake: 0,
  /** Snap instead of easing on the next frame (after teleports). */
  snap: true,
}

/** The local player's held boomerang: posed by LocalPlayer, drawn by BoomerangInstances. */
export const heldBoomerang = {
  visible: false,
  /** World position of the right hand. */
  position: new Vector3(),
  /** Character facing (radians). */
  yaw: 0,
  /** 0 = carried upright, 1 = flat like a frisbee (mid sidearm throw). */
  flat: 0,
}

/** How flat a held boomerang is at `phase` (0..1) of a throw; -1 = not throwing. */
export function throwFlatness(phase: number): number {
  if (phase < 0 || phase >= 1) return 0
  if (phase < 0.15) return phase / 0.15
  if (phase < 0.55) return 1
  return Math.max(0, 1 - (phase - 0.55) / 0.35)
}

/** Dev only: freeze the local throw at a phase (0..1) for screenshots; null = live. */
export const devPose: { throwPhase: number | null } = { throwPhase: null }

/** The render camera (set once by GameCanvas), for projecting world points to the screen. */
export const view: { camera: Camera | null } = { camera: null }

const _screen = new Vector3()

/** Screen position (CSS px) of a point `up` units above the local player. */
export function playerScreenPoint(up = 1.3): { x: number; y: number } {
  const cam = view.camera
  if (!cam) return { x: window.innerWidth / 2, y: window.innerHeight * 0.6 }
  _screen.set(localPlayer.pos.x, localPlayer.pos.y + up, localPlayer.pos.z).project(cam)
  return { x: (_screen.x * 0.5 + 0.5) * window.innerWidth, y: (-_screen.y * 0.5 + 0.5) * window.innerHeight }
}

/** Clock time of the last hit on the active wall (for its shake). */
export const wallFx = { hitAt: -10 }

/** Auto Win steering: the controller walks towards (x, z) when there's no manual input. */
export const autopilot = { active: false, x: 0, z: 0 }

/** Server-requested teleport, applied by the player controller next frame. */
export const pending: { teleport: TeleportMsg | null } = { teleport: null }

/** Length of one throw swing (s): wind-up, release, back to the hold. */
export const THROW_ANIM_S = 0.42

/**
 * When a throw swing (re)starts. A click during the wind-up doesn't restart it,
 * so spam-clicking keeps the arm cycling instead of freezing in the wind-up.
 */
export function throwStartAt(previous: number, t: number): number {
  return t - previous > THROW_ANIM_S * 0.5 ? t : previous
}

/** Seconds since page load — the shared clock for all animation. */
export const now = (): number => performance.now() / 1000

export function triggerShake(strength: number): void {
  cameraState.shake = Math.min(1.2, cameraState.shake + strength)
}
