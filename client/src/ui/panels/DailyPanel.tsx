import { C2S, DAILY_REWARDS, dailyCanClaim, dailyNextDay } from '@game/shared'

import { playSfx } from '../../audio/sfx'
import { send } from '../../net/connection'
import { useGame } from '../../state/gameStore'
import { ui } from '../../state/uiStore'
import { useServerClock } from '../hooks'
import { CalendarIcon } from '../icons'
import { describeReward } from '../rewardText'
import { Window } from '../Window'

/** 7-day login calendar. Missing a day resets the streak to day 1; day 7 is a pet. */
export function DailyPanel() {
  const data = useGame((s) => s.data)
  const now = useServerClock(5000)
  if (!data) return null
  const next = dailyNextDay(data, now)
  const can = dailyCanClaim(data, now)
  // Days already collected in the current streak.
  const collected = can ? next - 1 : data.daily.streak

  return (
    <Window title="Daily Rewards" onClose={() => ui().closePanel()} width={960}>
      <div className="body-text mb-3 text-center text-[17px]">Log in every day for bigger rewards — miss a day and the streak starts over.</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-7">
        {DAILY_REWARDS.map((reward, i) => {
          const day = i + 1
          const done = day <= collected
          const today = can && day === next
          return (
            <div
              key={day}
              className="flex flex-col items-center gap-2 rounded-xl border-4 border-[#1b1b22] bg-[#1a1c24] p-2"
              style={today ? { borderColor: '#ffd21f', boxShadow: '0 0 14px #ffd21f' } : done ? { opacity: 0.55 } : undefined}
            >
              <CalendarIcon size={50} day={day} />
              <div className="txt-outline text-[20px]">Day {day}</div>
              <div className="flex min-h-[64px] flex-col items-center">
                {describeReward(reward, data).map((l) => (
                  <span key={l.text} className="txt-outline text-center text-[14px]" style={{ color: l.color }}>
                    {l.text}
                  </span>
                ))}
              </div>
              {done && <span className="txt-outline text-[18px]" style={{ color: '#7dff6b' }}>✓</span>}
            </div>
          )
        })}
      </div>
      <div className="mt-5 flex justify-center">
        <button
          type="button"
          className="btn3d buy-btn bg-green"
          style={{ height: 70, minWidth: 260 }}
          disabled={!can}
          onClick={() => {
            playSfx('click')
            send(C2S.claimDaily)
          }}
        >
          <span className="txt-outline text-[34px]">{can ? `Claim Day ${next}` : 'Come back tomorrow!'}</span>
        </button>
      </div>
    </Window>
  )
}
