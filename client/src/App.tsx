import { C2S, sanitizeName } from '@game/shared'
import { useCallback, useEffect, useRef, useState } from 'react'

import { unlockAudio } from './audio/sfx'
import { useBloxitySession as useBloxity } from './bloxity/session'
import { bindKeyboard } from './game/controls'
import { GameCanvas } from './game/GameCanvas'
import { startLogic } from './game/logicTick'
import { send } from './net/connection'
import { adoptBloxityName } from './net/identity'
import { useGame } from './state/gameStore'
import { isTouchDevice } from './state/qualityStore'
import { mountFloatingLayer } from './ui/floating'
import { Hud } from './ui/Hud'
import { NameTags } from './ui/NameTags'
import { prefetchPanels } from './ui/PanelHost'
import { ConnectionOverlay, LoadingScreen, MobileControls } from './ui/Screens'

/** HUD scale: the HUD is laid out for ~1600×900 and scales to fit any screen. */
function useHudScale(): void {
  useEffect(() => {
    const update = () => {
      const s = Math.min(window.innerWidth / 1600, window.innerHeight / 900)
      document.documentElement.style.setProperty('--hud-scale', String(Math.min(1.1, Math.max(0.42, s))))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
}

export default function App() {
  const { game, status: sdkStatus, identity } = useBloxity()
  const rootRef = useRef<HTMLDivElement>(null)
  const [avatarReady, setAvatarReady] = useState(false)
  const [firstFrame, setFirstFrame] = useState(false)
  const status = useGame((s) => s.status)
  const hasData = useGame((s) => s.data !== null)

  useHudScale()
  useEffect(() => bindKeyboard(), [])
  useEffect(() => startLogic(), [])
  useEffect(() => (rootRef.current ? mountFloatingLayer(rootRef.current) : undefined), [])

  // Audio may only start after a user gesture.
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  // The Bloxity display name replaces the automatic "Player1234" once it's known.
  useEffect(() => {
    const name = adoptBloxityName(sanitizeName(identity?.displayName || identity?.username || ''))
    if (name) send(C2S.setName, { name })
  }, [identity])

  // Playable once joined and a frame is on screen; the Bloxity avatar streams in
  // behind a stand-in body rather than holding up the loading screen.
  const ready = firstFrame && hasData
  useEffect(() => {
    game.loadingStep(status === 'connected' ? 'Loading world…' : 'Connecting…')
  }, [game, status])
  useEffect(() => {
    if (!ready) return
    game.loadingEnd()
    prefetchPanels()
  }, [ready, game])

  // Startup milestones for tools/perf-probe.ts (performance.getEntriesByType('mark')).
  useEffect(() => {
    if (firstFrame) performance.mark('bpc:first-frame')
  }, [firstFrame])
  useEffect(() => {
    if (avatarReady) performance.mark('bpc:avatar')
  }, [avatarReady])
  useEffect(() => {
    if (hasData) performance.mark('bpc:joined')
  }, [hasData])
  useEffect(() => {
    if (ready) performance.mark('bpc:playable')
  }, [ready])
  useEffect(() => {
    if (sdkStatus === 'ready') performance.mark('bpc:sdk')
  }, [sdkStatus])

  const onAvatarReady = useCallback(() => setAvatarReady(true), [])
  const onFirstFrame = useCallback(() => setFirstFrame(true), [])

  return (
    <div ref={rootRef} className={`relative h-screen w-screen overflow-hidden ${isTouchDevice() ? 'touch' : ''}`}>
      <GameCanvas onAvatarReady={onAvatarReady} onFirstFrame={onFirstFrame} />
      {hasData && <NameTags />}
      {hasData && <Hud />}
      {hasData && <MobileControls />}
      <LoadingScreen ready={ready} />
      <ConnectionOverlay />
    </div>
  )
}
