import { useEffect, useState } from 'react'

import { serverNow, useGame } from '../state/gameStore'
import { quality } from '../state/qualityStore'

/** Re-renders every `ms` and returns the server clock — for countdowns. */
export function useServerClock(ms = 1000): number {
  const [now, setNow] = useState(serverNow)
  useEffect(() => {
    const id = window.setInterval(() => setNow(serverNow()), ms)
    return () => window.clearInterval(id)
  }, [ms])
  return now
}

type GameState = ReturnType<typeof useGame.getState>

/**
 * Like useGame(selector), but re-renders at most once every `ms` (trailing edge).
 * For HUD numbers that change on every throw: two store updates per throw
 * (prediction, then the server's answer) would otherwise re-render and repaint
 * them ~20 times a second. `selector` must be a stable (module-level) function.
 */
/** Light HUD (LOW preset): numbers refresh at most every 200 ms instead of 120 ms. */
const throttleMs = () => (quality().lightHud ? 200 : 120)

export function useGameThrottled<T>(selector: (s: GameState) => T, ms = throttleMs()): T {
  const [value, setValue] = useState(() => selector(useGame.getState()))
  useEffect(() => {
    let timer: number | null = null
    let last = selector(useGame.getState())
    const flush = () => {
      timer = null
      const v = selector(useGame.getState())
      if (!Object.is(v, last)) {
        last = v
        setValue(v)
      }
    }
    const unsubscribe = useGame.subscribe(() => {
      if (timer === null) timer = window.setTimeout(flush, ms)
    })
    flush()
    return () => {
      unsubscribe()
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [selector, ms])
  return value
}
