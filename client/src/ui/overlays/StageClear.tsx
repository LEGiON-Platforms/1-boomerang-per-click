import { C2S, formatNumber, STAGE_COUNT, stageDef } from '@game/shared'
import { useEffect } from 'react'

import { playSfx } from '../../audio/sfx'
import { send } from '../../net/connection'
import { useGame } from '../../state/gameStore'
import { useUI } from '../../state/uiStore'
import { TrophyIcon } from '../icons'

/** After claiming a win pad: go on to the next stage, or farm this one again. */
export function StageClear() {
  const clear = useUI((s) => s.stageClear)
  const set = useUI((s) => s.set)
  const autoWin = useGame((s) => s.autoWin)

  // Auto Win handles the choice itself (it always farms).
  useEffect(() => {
    if (clear && autoWin) set({ stageClear: null })
  }, [clear, autoWin, set])

  if (!clear || autoWin) return null
  const close = () => set({ stageClear: null })
  const choose = (choice: 'next' | 'farm') => {
    playSfx('click')
    send(C2S.stageChoice, { choice })
    close()
  }
  const last = clear.stage >= STAGE_COUNT

  return (
    <div className="overlay-center" style={{ zIndex: 45, pointerEvents: 'none' }}>
      <div className="window-scale" style={{ pointerEvents: 'auto' }}>
        <div className="window studs" style={{ width: 'min(620px, calc(100vw - 32px))' }}>
          <div className="window-title txt-outline">Stage {clear.stage} Cleared!</div>
          <div className="window-body flex flex-col items-center gap-4 text-center">
            <div className="txt-outline flex items-center gap-3 text-[52px]" style={{ color: '#5dff7a' }}>
              <TrophyIcon size={56} />+{formatNumber(clear.wins)} Wins
            </div>
            {clear.unlocked > 0 && (
              <div className="txt-outline text-[26px]" style={{ color: '#ffe14a' }}>
                Stage {clear.unlocked} · {stageDef(clear.unlocked).material} unlocked!
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-4">
              {!last && (
                <button type="button" className="btn3d buy-btn bg-green" style={{ height: 72, minWidth: 230 }} onClick={() => choose('next')}>
                  <span className="txt-outline text-[34px]">Next Stage ▶</span>
                </button>
              )}
              <button type="button" className="btn3d buy-btn bg-blue" style={{ height: 72, minWidth: 230 }} onClick={() => choose('farm')}>
                <span className="txt-outline text-[34px]">Farm Again ↻</span>
              </button>
            </div>
            {last && <div className="body-text text-[18px]">You beat the final stage! Rebirth to go again, stronger.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
