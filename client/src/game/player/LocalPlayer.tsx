import { useFrame } from '@react-three/fiber'
import {
  ANIM,
  bestBoomerangId,
  constrainPosition,
  GRAVITY,
  JUMP_VELOCITY,
  MOVE_SPEED,
  SPRINT_MULT,
} from '@game/shared'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { type Bone, type Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'

import { type AvatarRig, PlayerAvatar } from '../../bloxity/session'
import { game, useGame } from '../../state/gameStore'
import { getBoomerangGeometry } from '../assets'
import { boomerangLook } from '../fx/projectiles'
import { autopilot, cameraState, input, localPlayer, now, pending } from '../runtime'

export const PLAYER_HEIGHT = 2.2
const THROW_ANIM_S = 0.38

const _move = new Vector3()

const lerpAngle = (a: number, b: number, t: number) => {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

/**
 * The local player: kinematic controller (no physics engine — the world is flat
 * and its only obstacles are boxes) plus the Bloxity avatar.
 *
 * Movement uses the same shared constrainPosition() the server validates with,
 * so legal client moves are never rubber-banded.
 */
export function LocalPlayer({ onAvatarReady }: { onAvatarReady?: () => void }) {
  const rootRef = useRef<Group>(null)
  const visualRef = useRef<Group>(null)
  const motionRef = useRef({ time: 0, speed: 0, grounded: true, maxSpeed: MOVE_SPEED, throwPhase: -1 })
  const handRef = useRef<Bone | null>(null)

  const boomerangId = useGame((s) => (s.data ? bestBoomerangId(s.data) : 0))
  const vip = useGame((s) => s.data?.vipBoomerang ?? false)

  // Held boomerang: one mesh that follows the right-hand bone in world space.
  const held = useMemo(() => {
    const m = new Mesh(getBoomerangGeometry(), new MeshStandardMaterial({ roughness: 0.45, metalness: 0.15 }))
    m.castShadow = true
    m.scale.setScalar(0.62)
    return m
  }, [])
  useEffect(() => {
    const look = boomerangLook(boomerangId, vip)
    const mat = held.material as MeshStandardMaterial
    mat.color.set(look.color)
    mat.emissive.set(look.color).multiplyScalar(look.glow * 0.6)
  }, [boomerangId, vip, held])
  useEffect(
    () => () => {
      ;(held.material as MeshStandardMaterial).dispose()
    },
    [held],
  )

  const onRig = useCallback((rig: AvatarRig) => {
    handRef.current = rig.bones.ArmR2?.bone ?? null
  }, [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const lp = localPlayer
    const t = now()

    // Server teleports (stage menu, farm again, corrections).
    const tp = pending.teleport
    if (tp) {
      pending.teleport = null
      lp.pos.set(tp.x, 0, tp.z)
      lp.velY = 0
      lp.rotY = tp.rotY
      cameraState.yaw = tp.rotY + Math.PI
      cameraState.snap = true
    }

    // --- Horizontal input, relative to the camera's yaw --------------------
    const ix = (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.joyX
    const iy = (input.forward ? 1 : 0) - (input.backward ? 1 : 0) + input.joyY
    let mag = Math.min(1, Math.hypot(ix, iy))
    const yaw = cameraState.yaw
    // Camera sits at (sin yaw, cos yaw) from the player: forward is the opposite.
    const fx = -Math.sin(yaw)
    const fz = -Math.cos(yaw)
    _move.set(fx * iy + Math.cos(yaw) * ix, 0, fz * iy - Math.sin(yaw) * ix)
    if (_move.lengthSq() > 1e-6) _move.normalize()
    else mag = 0

    // Auto Win steers only while the player isn't steering themselves.
    let autoSprint = false
    if (mag === 0 && autopilot.active) {
      const dx = autopilot.x - lp.pos.x
      const dz = autopilot.z - lp.pos.z
      const d = Math.hypot(dx, dz)
      if (d > 0.6) {
        _move.set(dx / d, 0, dz / d)
        mag = 1
        autoSprint = true
      }
    }

    const sprint = autoSprint || input.sprint || Math.hypot(input.joyX, input.joyY) > 0.92
    const speed = MOVE_SPEED * (sprint ? SPRINT_MULT : 1) * mag
    const run = game().run
    const c = constrainPosition(lp.pos.x + _move.x * speed * dt, lp.pos.z + _move.z * speed * dt, run)
    const moved = Math.hypot(c.x - lp.pos.x, c.z - lp.pos.z)
    lp.pos.x = c.x
    lp.pos.z = c.z
    lp.speed = dt > 0 ? moved / dt : 0

    // --- Jump / gravity -----------------------------------------------------
    if (input.jump && lp.grounded) {
      lp.velY = JUMP_VELOCITY
      lp.grounded = false
    }
    if (!lp.grounded || lp.pos.y > 0) {
      lp.velY -= GRAVITY * dt
      lp.pos.y += lp.velY * dt
      if (lp.pos.y <= 0) {
        lp.pos.y = 0
        lp.velY = 0
        lp.grounded = true
      }
    }

    // --- Facing: movement direction, or the throw target while aiming --------
    let targetYaw: number | null = null
    if (mag > 0) targetYaw = Math.atan2(_move.x, _move.z)
    else if (lp.aimYaw !== null && t < lp.aimUntil) targetYaw = lp.aimYaw
    if (targetYaw !== null) lp.rotY = lerpAngle(lp.rotY, targetYaw, 1 - Math.exp(-14 * dt))

    lp.anim = !lp.grounded ? ANIM.jump : lp.speed > 0.2 ? (sprint ? ANIM.run : ANIM.walk) : ANIM.idle

    // --- Visuals --------------------------------------------------------------
    rootRef.current?.position.copy(lp.pos)
    if (visualRef.current) visualRef.current.rotation.y = lp.rotY
    const motion = motionRef.current
    motion.time += dt
    motion.speed = lp.speed
    motion.grounded = lp.grounded
    motion.maxSpeed = MOVE_SPEED * SPRINT_MULT
    const since = t - lp.throwAt
    motion.throwPhase = since < THROW_ANIM_S ? since / THROW_ANIM_S : -1

    const hand = handRef.current
    if (hand) {
      hand.getWorldPosition(held.position)
      held.rotation.set(Math.PI / 2 - 0.4, lp.rotY + Math.PI / 2, 0)
      held.rotateZ(motion.throwPhase >= 0 ? motion.throwPhase * Math.PI * 4 : 0)
    } else {
      held.position.set(lp.pos.x, lp.pos.y + 1.2, lp.pos.z)
    }
    held.visible = state.camera.position.distanceToSquared(lp.pos) > 1
  })

  return (
    <>
      <group ref={rootRef}>
        <group ref={visualRef}>
          <PlayerAvatar onReady={onAvatarReady} onRig={onRig} targetHeight={PLAYER_HEIGHT} motionRef={motionRef} />
        </group>
      </group>
      <primitive object={held} />
    </>
  )
}

export default LocalPlayer
