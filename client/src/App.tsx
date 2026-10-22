import { useCallback, useEffect, useRef, useState } from 'react'

import { unlockAudio } from './audio/sfx'
import { useBloxitySession as useBloxity } from './bloxity/session'
import { bindKeyboard } from './game/controls'
import { GameCanvas } from './game/GameCanvas'
import { startLogic } from './game/logicTick'
import { connect } from './net/connection'
import { getSavedName } from './net/identity'
import { useGame } from './state/gameStore'
import { isTouchDevice } from './state/qualityStore'
import { useUI } from './state/uiStore'
import { mountFloatingLayer } from './ui/floating'
import { Hud } from './ui/Hud'
import { ConnectionOverlay, LoadingScreen, MobileControls, NamePrompt } from './ui/Screens'

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
  const { game } = useBloxity()
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

  // Returning players join straight away; first-timers pick a name first.
  useEffect(() => {
    const saved = getSavedName()
    if (saved) void connect(saved)
    else useUI.getState().set({ needsName: true })
  }, [])

  const ready = avatarReady && firstFrame && hasData
  useEffect(() => {
    game.loadingStep(status === 'connected' ? 'Loading world…' : 'Connecting…')
  }, [game, status])
  useEffect(() => {
    if (ready) game.loadingEnd()
  }, [ready, game])

  const onAvatarReady = useCallback(() => setAvatarReady(true), [])
  const onFirstFrame = useCallback(() => setFirstFrame(true), [])

  return (
    <div ref={rootRef} className={`relative h-screen w-screen overflow-hidden ${isTouchDevice() ? 'touch' : ''}`}>
      <GameCanvas onAvatarReady={onAvatarReady} onFirstFrame={onFirstFrame} />
      {hasData && <Hud />}
      {hasData && <MobileControls />}
      <LoadingScreen ready={ready} />
      <NamePrompt />
      <ConnectionOverlay />
    </div>
  )
}
