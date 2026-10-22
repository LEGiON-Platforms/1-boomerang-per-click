import { ANIM, SPAWN, type TeleportMsg } from '@game/shared'
import { Vector3 } from 'three'

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

/** Clock time of the last hit on the active wall (for its shake). */
export const wallFx = { hitAt: -10 }

/** Auto Win steering: the controller walks towards (x, z) when there's no manual input. */
export const autopilot = { active: false, x: 0, z: 0 }

/** Server-requested teleport, applied by the player controller next frame. */
export const pending: { teleport: TeleportMsg | null } = { teleport: null }

/** Seconds since page load — the shared clock for all animation. */
export const now = (): number => performance.now() / 1000

export function triggerShake(strength: number): void {
  cameraState.shake = Math.min(1.2, cameraState.shake + strength)
}
