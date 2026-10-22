import { useFrame } from '@react-three/fiber'
import { ANIM, MOVE_SPEED, parseAvatarLook, SPRINT_MULT } from '@game/shared'
import { memo, Suspense, useCallback, useMemo, useRef } from 'react'
import { type Bone, type Group, Vector3 } from 'three'

import { type AvatarRig, PlayerAvatar } from '../../bloxity/session'
import { remotePlayers } from '../../net/remote'
import { useGame } from '../../state/gameStore'
import { now, THROW_ANIM_S } from '../runtime'
import { PLAYER_HEIGHT } from './LocalPlayer'

/**
 * Nearby players as their real Bloxity avatars (the logic tick picks which, by
 * distance and the quality preset's limit). Everyone else stays a blocky body in
 * RemotePlayers' single instanced draw.
 */
const RemoteAvatar = memo(function RemoteAvatar({ id, avatar }: { id: string; avatar: string }) {
  const rootRef = useRef<Group>(null)
  const look = useMemo(() => parseAvatarLook(avatar), [avatar])
  const motionRef = useRef({ time: 0, speed: 0, grounded: true, maxSpeed: MOVE_SPEED * SPRINT_MULT, velY: 0, throwPhase: -1 })
  const handRef = useRef<Bone | null>(null)
  const handLocal = useMemo(() => new Vector3(), [])

  const onRig = useCallback(
    (rig: AvatarRig) => {
      const forearm = rig.bones.ArmR2
      handRef.current = forearm?.bone ?? null
      if (forearm?.axisX && forearm.axisZ) {
        handLocal.crossVectors(forearm.axisX, forearm.axisZ).normalize().multiplyScalar(forearm.bone.position.length())
      }
    },
    [handLocal],
  )

  // Runs after RemotePlayers has interpolated this frame's pose (mounted after it).
  useFrame((_s, delta) => {
    const p = remotePlayers.get(id)
    const root = rootRef.current
    if (!p || !root) return
    root.position.set(p.px, p.py, p.pz)
    root.rotation.y = p.prot
    const m = motionRef.current
    const t = now()
    m.time += delta
    m.speed = p.speed
    m.grounded = p.anim !== ANIM.jump
    m.throwPhase = t - p.throwAt < THROW_ANIM_S ? (t - p.throwAt) / THROW_ANIM_S : -1
    const hand = handRef.current
    if (hand) {
      hand.updateWorldMatrix(true, false)
      p.hand.copy(handLocal).applyMatrix4(hand.matrixWorld)
      p.handAt = t
    }
  })

  return (
    <group ref={rootRef}>
      <Suspense fallback={null}>
        <PlayerAvatar look={look} onRig={onRig} targetHeight={PLAYER_HEIGHT} motionRef={motionRef} />
      </Suspense>
    </group>
  )
})

export function RemoteAvatars() {
  const list = useGame((s) => s.fullAvatars)
  return (
    <>
      {list.map((a) => (
        <RemoteAvatar key={a.id} id={a.id} avatar={a.avatar} />
      ))}
    </>
  )
}

export default RemoteAvatars
