import type { ComponentType, RefObject } from 'react'

import { useBloxity } from './BloxityContext'
import PlayerAvatarJs from '../game/PlayerAvatar.jsx'

/**
 * Typed views of the (JavaScript) Bloxity integration, so TypeScript callers get
 * real types instead of `never` from the untyped context.
 */

export interface BloxityIdentity {
  _id?: string
  displayName?: string
  username?: string
  pfp?: string
}

export interface BloxitySession {
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: Error | null
  isReady: boolean
  isLoggedIn: boolean
  identity: BloxityIdentity | null
  login: () => void
  logout: () => void
  game: {
    loadingStep: (label: string) => void
    loadingEnd: () => void
    updateRoom: (room: unknown) => void
  }
}

export const useBloxitySession = useBloxity as unknown as () => BloxitySession

export interface AvatarRig {
  /** axisX / axisZ: the character's X and Z axes in the bone's local frame. */
  bones: Record<string, { bone: import('three').Bone; axisX?: import('three').Vector3; axisZ?: import('three').Vector3 } | undefined>
}

export interface PlayerAvatarProps {
  /** Another player's look; omitted = the local Bloxity avatar. */
  look?: import('@game/shared').AvatarLook
  onReady?: () => void
  onRig?: (rig: AvatarRig) => void
  targetHeight?: number
  /** `skipRef.current = n` poses the rig only every n-th frame (far-away players). */
  skipRef?: RefObject<number>
  motionRef?: RefObject<{ time: number; speed: number; grounded: boolean; maxSpeed: number; velY?: number; throwPhase: number }>
}

export const PlayerAvatar = PlayerAvatarJs as unknown as ComponentType<PlayerAvatarProps>
