import { useFrame } from '@react-three/fiber'
import {
  ANIM,
  constrainPosition,
  GRAVITY,
  groundHeight,
  JUMP_VELOCITY,
  MOVE_SPEED,
  SPRINT_MULT,
  STEP_UP,
} from '@game/shared'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type Bone, type Group, MeshLambertMaterial, Vector3 } from 'three'

import { type AvatarRig, PlayerAvatar } from '../../bloxity/session'
import { game } from '../../state/gameStore'
import { PropBuilder } from '../builder'
import {
  autopilot,
  CATCH_ANIM_S,
  cameraState,
  catchFlatness,
  devPose,
  heldBoomerang,
  input,
  localPlayer,
  now,
  pending,
  THROW_ANIM_S,
  throwFlatness,
} from '../runtime'

export const PLAYER_HEIGHT = 2.2

const _move = new Vector3()
/** The hand, in the forearm bone's frame (the rig has no hand bone): set from the rig. */
const handLocal = new Vector3()

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
  const motionRef = useRef({ time: 0, speed: 0, grounded: true, maxSpeed: MOVE_SPEED, velY: 0, throwPhase: -1, catchPhase: -1 })
  const handRef = useRef<Bone | null>(null)

  // The held boomerang is drawn by BoomerangInstances; this only poses it.
  useEffect(
    () => () => {
      heldBoomerang.visible = false
    },
    [],
  )

  const onRig = useCallback((rig: AvatarRig) => {
    const forearm = rig.bones.ArmR2
    handRef.current = forearm?.bone ?? null
    if (forearm?.axisX && forearm.axisZ) {
      // Character "down" (X × Z) in the forearm's frame, one upper-arm length long:
      // the hand at the end of the forearm in the rest pose.
      handLocal.crossVectors(forearm.axisX, forearm.axisZ).normalize().multiplyScalar(forearm.bone.position.length())
    }
  }, [])

  const [avatarShown, setAvatarShown] = useState(false)
  const handleAvatarReady = useCallback(() => {
    setAvatarShown(true)
    onAvatarReady?.()
  }, [onAvatarReady])

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
    const speed = MOVE_SPEED * (sprint ? SPRINT_MULT : 1) * mag * lp.speedMult
    const run = game().run
    const c = constrainPosition(lp.pos.x + _move.x * speed * dt, lp.pos.z + _move.z * speed * dt, run)
    let nx = c.x
    let nz = c.z
    // Raised floors (the Boomerang Stage): a ledge taller than STEP_UP blocks; slide
    // along whichever axis is still walkable.
    if (groundHeight(nx, nz) - lp.pos.y > STEP_UP) {
      if (groundHeight(nx, lp.pos.z) - lp.pos.y <= STEP_UP) nz = lp.pos.z
      else if (groundHeight(lp.pos.x, nz) - lp.pos.y <= STEP_UP) nx = lp.pos.x
      else {
        nx = lp.pos.x
        nz = lp.pos.z
      }
    }
    const moved = Math.hypot(nx - lp.pos.x, nz - lp.pos.z)
    lp.pos.x = nx
    lp.pos.z = nz
    lp.speed = dt > 0 ? moved / dt : 0

    // --- Jump / gravity / stairs -----------------------------------------------
    const ground = groundHeight(lp.pos.x, lp.pos.z)
    if (input.jump && lp.grounded) {
      lp.velY = JUMP_VELOCITY
      lp.grounded = false
    }
    if (lp.grounded && lp.pos.y > ground + 0.05) lp.grounded = false // walked off a step
    if (!lp.grounded) {
      lp.velY -= GRAVITY * dt
      lp.pos.y += lp.velY * dt
      if (lp.pos.y <= ground) {
        lp.pos.y = ground
        lp.velY = 0
        lp.grounded = true
      }
    } else if (lp.pos.y < ground) {
      lp.pos.y = ground // stepped up
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
    // The base sprint: level speed bonuses go past it and quicken the stride.
    motion.maxSpeed = MOVE_SPEED * SPRINT_MULT
    motion.velY = lp.velY
    const since = t - lp.throwAt
    motion.throwPhase = since < THROW_ANIM_S ? since / THROW_ANIM_S : -1
    if (import.meta.env.DEV && devPose.throwPhase !== null) motion.throwPhase = devPose.throwPhase
    const caught = t - lp.catchAt
    motion.catchPhase = caught < CATCH_ANIM_S ? caught / CATCH_ANIM_S : -1

    const held = heldBoomerang
    const hand = handRef.current
    if (hand) {
      hand.updateWorldMatrix(true, false)
      held.position.copy(handLocal).applyMatrix4(hand.matrixWorld)
    } else {
      held.position.set(lp.pos.x - Math.cos(lp.rotY) * 0.6, lp.pos.y + 1.4, lp.pos.z + Math.sin(lp.rotY) * 0.6)
    }
    held.yaw = lp.rotY
    held.flat = Math.max(throwFlatness(motion.throwPhase), catchFlatness(motion.catchPhase))
    held.visible = state.camera.position.distanceToSquared(lp.pos) > 1
  })

  return (
    <>
      <group ref={rootRef}>
        <group ref={visualRef}>
          {!avatarShown && <StandInBody />}
          {/* Only the avatar suspends on its download — the controller above keeps running. */}
          <Suspense fallback={null}>
            <group visible={avatarShown}>
              <PlayerAvatar onReady={handleAvatarReady} onRig={onRig} targetHeight={PLAYER_HEIGHT} motionRef={motionRef} />
            </group>
          </Suspense>
        </group>
      </group>
    </>
  )
}

/** A blocky body (one draw call) shown while the Bloxity avatar downloads. */
function StandInBody() {
  const geometry = useMemo(() => {
    const b = new PropBuilder()
    b.block(0, 1.55, 0, 0.62, 0.62, 0.62, '#ffd9a8') // head
    b.block(0, 0.8, 0, 0.84, 0.76, 0.42, '#2f8cff') // torso
    b.block(-0.58, 0.82, 0, 0.3, 0.74, 0.34, '#ffd9a8') // arms
    b.block(0.58, 0.82, 0, 0.3, 0.74, 0.34, '#ffd9a8')
    b.block(-0.21, 0, 0, 0.38, 0.8, 0.38, '#2b3a67') // legs
    b.block(0.21, 0, 0, 0.38, 0.8, 0.38, '#2b3a67')
    return b.build()
  }, [])
  const material = useMemo(() => new MeshLambertMaterial({ vertexColors: true }), [])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )
  return <mesh geometry={geometry} material={material} castShadow scale={PLAYER_HEIGHT / 1.9} />
}

export default LocalPlayer
