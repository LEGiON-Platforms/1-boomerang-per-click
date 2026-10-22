import { useEffect, useState } from 'react'

import { serverNow } from '../state/gameStore'

/** Re-renders every `ms` and returns the server clock — for countdowns. */
export function useServerClock(ms = 1000): number {
  const [now, setNow] = useState(serverNow)
  useEffect(() => {
    const id = window.setInterval(() => setNow(serverNow()), ms)
    return () => window.clearInterval(id)
  }, [ms])
  return now
}
