import { formatNumber, STAGE_COUNT, stageDef } from '@game/shared'
import { useEffect } from 'react'

import { ui, useUI } from '../../state/uiStore'
import { TrophyIcon } from '../icons'

const SHOW_MS = 2600

/**
 * Banner after claiming a win pad. The server sends the player back to the lobby
 * a moment later, lined up for the next stage; trophies fly to the Wins counter.
 */
export function StageClear() {
  const clear = useUI((s) => s.stageClear)

  useEffect(() => {
    if (!clear) return
    const id = window.setTimeout(() => ui().set({ stageClear: null }), SHOW_MS)
    return () => window.clearTimeout(id)
  }, [clear])

  if (!clear) return null
  return (
    <div className="stage-clear">
      <div className="title txt-outline">Stage {clear.stage} Clear!</div>
      <div className="txt-outline flex items-center gap-3 text-[48px]" style={{ color: '#5dff7a' }}>
        <TrophyIcon size={52} />+{formatNumber(clear.wins)} Wins
      </div>
      {clear.unlocked > 0 && (
        <div className="txt-outline text-[26px]" style={{ color: '#ffe14a' }}>
          Stage {clear.unlocked} · {stageDef(clear.unlocked).material} unlocked!
        </div>
      )}
      {clear.stage >= STAGE_COUNT && (
        <div className="txt-outline text-[22px]">You beat the final stage! Rebirth to go again, stronger.</div>
      )}
    </div>
  )
}
