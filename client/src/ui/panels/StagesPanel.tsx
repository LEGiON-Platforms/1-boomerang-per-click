import {
  C2S,
  formatNumber,
  highestUnlockedStage,
  padWins,
  STAGES,
  stageTotalHp,
} from '@game/shared'

import { playSfx } from '../../audio/sfx'
import { send } from '../../net/connection'
import { useGame } from '../../state/gameStore'
import { ui } from '../../state/uiStore'
import { LockIcon, TrophyIcon } from '../icons'
import { Window } from '../Window'

/** Teleport to any unlocked stage (to farm your best one), or back to the lobby. */
export function StagesPanel() {
  const data = useGame((s) => s.data)
  const runStage = useGame((s) => s.run.stage)
  const here = useGame((s) => s.stageHere)
  if (!data) return null
  const unlocked = highestUnlockedStage(data)

  const go = (stage: number) => {
    playSfx('click')
    send(C2S.teleportStage, { stage })
    ui().closePanel()
  }

  return (
    <Window title="Stages" onClose={() => ui().closePanel()} width={960}>
      <div className="mb-4 flex items-center justify-between">
        <div className="body-text text-[17px]">
          Highest unlocked: <b>Stage {unlocked}</b> · resets on Rebirth
        </div>
        <button type="button" className="btn3d buy-btn bg-orange" onClick={() => go(0)} disabled={here === 0}>
          <span className="txt-outline">Lobby</span>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {STAGES.map((s) => {
          const locked = s.stage > unlocked
          const active = s.stage === runStage && here === s.stage
          return (
            <button
              key={s.stage}
              type="button"
              disabled={locked}
              onClick={() => go(s.stage)}
              className="btn3d relative flex flex-col items-center gap-1 px-2 py-3"
              style={{
                background: locked ? '#30323d' : `linear-gradient(180deg, ${s.color}, ${s.accent})`,
                outline: active ? '4px solid #fff' : undefined,
              }}
            >
              <span className="txt-outline text-[30px]">{s.stage}</span>
              <span className="txt-outline text-[18px]">{s.material}</span>
              {locked ? (
                <LockIcon size={30} />
              ) : (
                <span className="txt-outline flex items-center gap-1 text-[18px]" style={{ color: '#5dff7a' }}>
                  <TrophyIcon size={18} />+{formatNumber(padWins(s.stage))}
                </span>
              )}
              <span className="txt-outline text-[13px] opacity-80">{formatNumber(stageTotalHp(s.stage))} HP</span>
            </button>
          )
        })}
      </div>
    </Window>
  )
}
