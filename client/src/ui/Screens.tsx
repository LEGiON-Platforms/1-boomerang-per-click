import { useProgress } from '@react-three/drei'
import { bestBoomerangId } from '@game/shared'
import { useEffect, useRef, useState } from 'react'

import { unlockAudio } from '../audio/sfx'
import { boomerangLook } from '../game/boomerangShapes'
import { input } from '../game/runtime'
import { requestThrow } from '../game/throwing'
import { useGame } from '../state/gameStore'
import { isTouchDevice } from '../state/qualityStore'
import { BoomerangIcon, RebirthIcon } from './icons'

/** Loading screen: asset progress (drei useProgress) + connection state. */
export function LoadingScreen({ ready }: { ready: boolean }) {
  const { progress, active } = useProgress()
  const status = useGame((s) => s.status)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (!ready) return
    const id = window.setTimeout(() => setGone(true), 400)
    return () => window.clearTimeout(id)
  }, [ready])

  if (gone) return null
  const step = status !== 'connected' ? 'Connecting to the game server…' : active ? 'Loading your avatar…' : 'Almost there…'
  const pct = Math.round(status === 'connected' ? 60 + progress * 0.4 : Math.min(55, progress * 0.5))
  return (
    <div
      className="overlay-center"
      style={{
        zIndex: 80,
        background: 'linear-gradient(180deg,#2a8af5,#86c8fb)',
        opacity: ready ? 0 : 1,
        transition: 'opacity 0.4s',
      }}
    >
      <div className="flex flex-col items-center gap-5">
        <div className="flex items-center gap-4">
          <BoomerangIcon size={90} />
          <div className="txt-outline text-center text-[64px] leading-none">
            +1 Boomerang
            <br />
            <span style={{ color: '#ffe14a' }}>Per Click</span>
          </div>
          <RebirthIcon size={90} />
        </div>
        <div className="progress" style={{ width: 420 }}>
          <div className="fill" style={{ width: `${pct}%` }} />
          <div className="text txt-outline">{pct}%</div>
        </div>
        <div className="txt-outline text-[24px]">{step}</div>
      </div>
    </div>
  )
}

export function ConnectionOverlay() {
  const status = useGame((s) => s.status)
  const text = useGame((s) => s.statusText)
  if (status !== 'reconnecting' && status !== 'error' && status !== 'kicked') return null
  // Only a blocking overlay once we've been in the game (the loading screen covers the rest).
  const hadData = useGame.getState().data !== null
  if (!hadData && status !== 'kicked') return null
  return (
    <div className="overlay-center overlay-dim" style={{ zIndex: 70 }}>
      <div className="panel-card flex flex-col items-center gap-4 text-center">
        <span className="txt-outline">{text || 'Reconnecting…'}</span>
        {status === 'kicked' && (
          <button type="button" className="btn3d buy-btn bg-green" onClick={() => location.reload()}>
            <span className="txt-outline">Play here instead</span>
          </button>
        )}
      </div>
    </div>
  )
}

const STICK_RADIUS = 62

/** Touch controls: a virtual stick and a big THROW button (touch devices only). */
/** The boomerang the player throws (re-renders only when it changes). */
function EquippedBoomerang({ size }: { size: number }) {
  const id = useGame((s) => (s.data ? bestBoomerangId(s.data) : 0))
  const vip = useGame((s) => s.data?.vipBoomerang ?? false)
  return <BoomerangIcon size={size} look={boomerangLook(id, vip)} />
}

export function MobileControls() {
  const [touch] = useState(isTouchDevice)
  const knobRef = useRef<HTMLDivElement>(null)
  const repeat = useRef<number | null>(null)

  if (!touch) return null

  const moveKnob = (dx: number, dy: number) => {
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx}px, ${dy}px)`
  }

  const onStick = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    let dx = e.clientX - (r.left + r.width / 2)
    let dy = e.clientY - (r.top + r.height / 2)
    const d = Math.hypot(dx, dy)
    if (d > STICK_RADIUS) {
      dx = (dx / d) * STICK_RADIUS
      dy = (dy / d) * STICK_RADIUS
    }
    input.joyX = dx / STICK_RADIUS
    input.joyY = -dy / STICK_RADIUS
    moveKnob(dx, dy)
  }
  const releaseStick = () => {
    input.joyX = 0
    input.joyY = 0
    moveKnob(0, 0)
  }
  const stopRepeat = () => {
    if (repeat.current !== null) window.clearInterval(repeat.current)
    repeat.current = null
  }

  return (
    <>
      <div
        className="joystick"
        onPointerDown={(e) => {
          unlockAudio()
          e.currentTarget.setPointerCapture(e.pointerId)
          onStick(e)
        }}
        onPointerMove={(e) => e.buttons && onStick(e)}
        onPointerUp={releaseStick}
        onPointerCancel={releaseStick}
      >
        <div ref={knobRef} className="joystick-knob" />
      </div>
      <button
        type="button"
        className="btn3d throw-btn bg-orange"
        onPointerDown={(e) => {
          unlockAudio()
          e.currentTarget.setPointerCapture(e.pointerId)
          const r = e.currentTarget.getBoundingClientRect()
          const from = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
          requestThrow(from)
          stopRepeat()
          repeat.current = window.setInterval(() => requestThrow(from), 95)
        }}
        onPointerUp={stopRepeat}
        onPointerCancel={stopRepeat}
      >
        <EquippedBoomerang size={70} />
      </button>
      {/* Held like the Space key: jumps again on landing while the finger stays down. */}
      <button
        type="button"
        className="btn3d jump-btn bg-cyan"
        aria-label="Jump"
        onPointerDown={(e) => {
          unlockAudio()
          e.currentTarget.setPointerCapture(e.pointerId)
          input.jump = true
        }}
        onPointerUp={() => (input.jump = false)}
        onPointerCancel={() => (input.jump = false)}
      >
        <svg viewBox="0 0 64 64" width={46} height={46} aria-hidden>
          <path d="M32 8 L56 34 H42 V56 H22 V34 H8 Z" fill="#fff" stroke="#1b1b22" strokeWidth="5" strokeLinejoin="round" />
        </svg>
      </button>
    </>
  )
}
