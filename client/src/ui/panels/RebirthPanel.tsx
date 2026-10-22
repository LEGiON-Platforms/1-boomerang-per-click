import {
  C2S,
  levelForXp,
  PETS_CONFIG,
  rebirthLevel,
  rebirthMultiplier,
  rebirthProgressForXp,
  THROW,
} from '@game/shared'

import { playSfx } from '../../audio/sfx'
import { send } from '../../net/connection'
import { useGame } from '../../state/gameStore'
import { ui } from '../../state/uiStore'
import { RebirthIcon } from '../icons'
import { Window } from '../Window'

/** What reaching `next` rebirths newly unlocks. */
function unlocksAt(next: number): string[] {
  const out: string[] = []
  if (PETS_CONFIG.extraSlotRebirths.includes(next)) out.push('+1 pet slot')
  if (next === PETS_CONFIG.tripleOpenRebirths) out.push('Open 3 eggs at once')
  if (next === THROW.autoUnlockRebirths) out.push('Auto Throw (free)')
  return out
}

export function RebirthPanel() {
  const data = useGame((s) => s.data)
  const xp = useGame((s) => s.xp)
  if (!data) return null
  const r = data.rebirths
  const need = rebirthLevel(r)
  const level = levelForXp(xp)
  const can = level >= need
  const unlocks = unlocksAt(r + 1)

  return (
    <Window title="Rebirth" onClose={() => ui().closePanel()} width={720}>
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center">
            <span className="txt-outline text-[24px]">Now</span>
            <span className="txt-outline text-[54px]" style={{ color: '#ffffff' }}>
              x{rebirthMultiplier(r)}
            </span>
          </div>
          <RebirthIcon size={110} />
          <div className="flex flex-col items-center">
            <span className="txt-outline text-[24px]">Next</span>
            <span className="txt-outline text-[54px]" style={{ color: '#ff7ad9' }}>
              x{rebirthMultiplier(r + 1)}
            </span>
          </div>
        </div>
        <div className="txt-outline text-[26px]">Power multiplier · Rebirth {r} → {r + 1}</div>

        <div className="progress" style={{ width: 520, height: 40 }}>
          <div
            className="fill"
            style={{ width: `${rebirthProgressForXp(xp, r) * 100}%`, background: 'linear-gradient(180deg,#ff8ad8,#b04dff)' }}
          />
          <div className="text txt-outline" style={{ fontSize: 24 }}>
            Level {Math.min(level, need)} / {need}
          </div>
        </div>

        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
          <div className="list-row flex-col items-start" style={{ borderColor: '#ff4d4d' }}>
            <div className="txt-outline text-[26px]" style={{ color: '#ff6b6b' }}>
              You will lose
            </div>
            <div className="body-text text-[17px]">Power · Wins · Stage progress (back to Stage 1)</div>
          </div>
          <div className="list-row flex-col items-start" style={{ borderColor: '#3ee060' }}>
            <div className="txt-outline text-[26px]" style={{ color: '#7dff6b' }}>
              You will keep
            </div>
            <div className="body-text text-[17px]">Boomerangs · Trails · Pets · Pumpkins · Perks · Rebirths</div>
          </div>
        </div>
        {unlocks.length > 0 && (
          <div className="list-row w-full flex-col items-start" style={{ borderColor: '#ffd21f' }}>
            <div className="txt-outline text-[24px]" style={{ color: '#ffe14a' }}>
              Unlocks
            </div>
            <div className="body-text text-[17px]">{unlocks.join(' · ')}</div>
          </div>
        )}

        <button
          type="button"
          className="btn3d buy-btn bg-magenta"
          style={{ height: 76, minWidth: 300 }}
          disabled={!can}
          onClick={() => {
            playSfx('click')
            send(C2S.rebirth)
            ui().closePanel()
          }}
        >
          <RebirthIcon size={48} />
          <span className="txt-outline text-[40px]">{can ? 'REBIRTH' : `Reach Level ${need}`}</span>
        </button>
      </div>
    </Window>
  )
}
