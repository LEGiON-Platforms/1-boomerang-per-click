import { C2S, formatTimer, PLAYTIME_GIFTS } from '@game/shared'

import { playSfx } from '../../audio/sfx'
import { send } from '../../net/connection'
import { useGame } from '../../state/gameStore'
import { ui } from '../../state/uiStore'
import { useServerClock } from '../hooks'
import { GiftIcon } from '../icons'
import { describeReward } from '../rewardText'
import { Window } from '../Window'

/** Playtime gifts: 8 rewards unlocked by minutes played today. */
export function GiftsPanel() {
  const data = useGame((s) => s.data)
  const syncedAt = useGame((s) => s.syncedAt)
  useServerClock(1000)
  if (!data) return null
  const played = data.playtime.seconds + Math.max(0, (Date.now() - syncedAt) / 1000)

  return (
    <Window title="Free Gifts" onClose={() => ui().closePanel()} width={900}>
      <div className="body-text mb-3 text-center text-[17px]">Keep playing to unlock gifts. They reset every day.</div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {PLAYTIME_GIFTS.map((g, i) => {
          const claimed = data.playtime.claimed.includes(i)
          const ready = !claimed && played >= g.minutes * 60
          return (
            <div key={g.minutes} className="flex flex-col items-center gap-2 rounded-xl border-4 border-[#1b1b22] bg-[#1a1c24] p-3" style={ready ? { borderColor: '#ffd21f', boxShadow: '0 0 14px #ffd21f' } : undefined}>
              <GiftIcon size={56} />
              <div className="txt-outline text-[22px]">{g.minutes} min</div>
              <div className="flex min-h-[48px] flex-col items-center">
                {describeReward(g.reward, data).map((l) => (
                  <span key={l.text} className="txt-outline text-center text-[16px]" style={{ color: l.color }}>
                    {l.text}
                  </span>
                ))}
              </div>
              {claimed ? (
                <span className="txt-outline text-[22px]" style={{ color: '#9aa3b5' }}>
                  CLAIMED
                </span>
              ) : ready ? (
                <button
                  type="button"
                  className="btn3d buy-btn bg-green"
                  style={{ minWidth: 120, height: 48 }}
                  onClick={() => {
                    playSfx('click')
                    send(C2S.claimGift, { index: i })
                  }}
                >
                  <span className="txt-outline text-[24px]">CLAIM!</span>
                </button>
              ) : (
                <span className="txt-outline text-[22px]">{formatTimer(g.minutes * 60 - played)}</span>
              )}
            </div>
          )
        })}
      </div>
    </Window>
  )
}
