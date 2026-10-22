import { formatNumber, STAGE_COUNT } from '@game/shared'
import { useEffect } from 'react'

import { ui, useUI } from '../../state/uiStore'
import { TrophyIcon } from '../icons'

const SHOW_MS = 2600

/**
 * Banner after claiming a win pad. The server sends the player back to the lobby
 * a moment later, where every wall stands again; trophies fly to the Wins counter.
 */
export function StageClear() {
  const clear = useUI((s) => s.stageClear)

  useEffect(() => {
    if (!clear) return
    const id = window.setTimeout(() => ui().set({ stageClear: null }), SHOW_MS)
    return () => window.clearTimeout(id)
  }, [clear])

  if (!clear) return null
  const title = `Stage ${clear.stage} Clear!`
  const wins = `+${formatNumber(clear.wins)} Wins`
  return (
    <div className="stage-clear">
      <div className="ribbon">
        <span className="title grad-text" data-text={title}>
          {title}
        </span>
      </div>
      <div className="wins">
        <TrophyIcon size={56} />
        <span className="grad-text" data-text={wins}>
          {wins}
        </span>
      </div>
      {clear.stage >= STAGE_COUNT && (
        <div className="txt-outline text-[22px]">You beat the final stage! Rebirth to go again, stronger.</div>
      )}
    </div>
  )
}
