import { useProgress } from '@react-three/drei'
import { bestBoomerangId, sanitizeName } from '@game/shared'
import { useEffect, useRef, useState } from 'react'

import { unlockAudio } from '../audio/sfx'
import { useBloxitySession as useBloxity } from '../bloxity/session'
import { boomerangLook } from '../game/boomerangShapes'
import { input } from '../game/runtime'
import { requestThrow } from '../game/throwing'
import { connect } from '../net/connection'
import { saveName } from '../net/identity'
import { useGame } from '../state/gameStore'
import { isTouchDevice } from '../state/qualityStore'
import { useUI } from '../state/uiStore'
import { BoomerangIcon, RebirthIcon } from './icons'

/** Loading screen: asset progress (drei useProgress) + connection state. */
export function LoadingScreen({ ready }: { ready: boolean }) {
  const { progress, active } = useProgress()
  const status = useGame((s) => s.status)
  const needsName = useUI((s) => s.needsName)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (!ready) return
    const id = window.setTimeout(() => setGone(true), 400)
    return () => window.clearTimeout(id)
  }, [ready])

  if (gone || needsName) return null
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

/** First visit: pick a display name (prefilled from the Bloxity identity). */
export function NamePrompt() {
  const needsName = useUI((s) => s.needsName)
  const set = useUI((s) => s.set)
  const { identity } = useBloxity()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const touched = useRef(false)

  useEffect(() => {
    if (touched.current) return
    const suggested = sanitizeName(identity?.displayName || identity?.username || '')
    setName(suggested || `Player${Math.floor(1000 + Math.random() * 9000)}`)
  }, [identity])

  if (!needsName) return null
  const play = () => {
    const clean = sanitizeName(name)
    if (!clean) {
      setError('Use 3–20 letters, numbers or spaces.')
      return
    }
    unlockAudio()
    saveName(clean)
    set({ needsName: false })
    void connect(clean)
  }
  return (
    <div className="overlay-center" style={{ zIndex: 90, background: 'linear-gradient(180deg,#2a8af5,#86c8fb)' }}>
      <div className="window-scale">
        <div className="window studs" style={{ width: 'min(560px, calc(100vw - 32px))' }}>
          <div className="window-body flex flex-col items-center gap-4 text-center" style={{ paddingTop: 26 }}>
            <div className="txt-outline text-[48px]">Choose your name</div>
            <input
              autoFocus
              value={name}
              maxLength={20}
              onChange={(e) => {
                touched.current = true
                setName(e.target.value)
                setError('')
              }}
              onKeyDown={(e) => e.key === 'Enter' && play()}
              className="body-text h-[64px] w-full rounded-xl border-4 border-[#1b1b22] bg-[#111218] px-4 text-center text-[26px] text-white"
            />
            {error && <div className="body-text text-[16px] text-red-300">{error}</div>}
            <button type="button" className="btn3d buy-btn bg-green" style={{ height: 70, minWidth: 240 }} onClick={play}>
              <span className="txt-outline text-[40px]">PLAY</span>
            </button>
          </div>
        </div>
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
    </>
  )
}
