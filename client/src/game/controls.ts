import { unlockAudio } from '../audio/sfx'
import { ui } from '../state/uiStore'
import { interact } from './interact'
import { input } from './runtime'
import { requestThrow } from './throwing'

const MOVE_KEYS: Record<string, keyof typeof input> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
}

const typing = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null
  return Boolean(el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable))
}

let throwHeld: number | null = null

/** Keyboard → runtime.input (a ref, not React state). Returns an unbind function. */
export function bindKeyboard(): () => void {
  const onDown = (e: KeyboardEvent) => {
    unlockAudio()
    if (typing(e)) return
    const action = MOVE_KEYS[e.code]
    if (action) {
      e.preventDefault()
      ;(input[action] as boolean) = true
      return
    }
    if (e.repeat) return
    if (e.code === 'KeyE') interact()
    else if (e.code === 'KeyF' || e.code === 'Enter') {
      requestThrow()
      // Holding F keeps throwing at the max manual rate.
      if (throwHeld === null) throwHeld = window.setInterval(requestThrow, 95)
    } else if (e.code === 'Escape') ui().closePanel()
  }
  const onUp = (e: KeyboardEvent) => {
    const action = MOVE_KEYS[e.code]
    if (action) (input[action] as boolean) = false
    if ((e.code === 'KeyF' || e.code === 'Enter') && throwHeld !== null) {
      window.clearInterval(throwHeld)
      throwHeld = null
    }
  }
  // Alt-tabbing away mid-run otherwise leaves a key stuck down.
  const onBlur = () => {
    for (const k of Object.values(MOVE_KEYS)) (input[k] as boolean) = false
    if (throwHeld !== null) window.clearInterval(throwHeld)
    throwHeld = null
  }
  window.addEventListener('keydown', onDown)
  window.addEventListener('keyup', onUp)
  window.addEventListener('blur', onBlur)
  return () => {
    window.removeEventListener('keydown', onDown)
    window.removeEventListener('keyup', onUp)
    window.removeEventListener('blur', onBlur)
    onBlur()
  }
}
