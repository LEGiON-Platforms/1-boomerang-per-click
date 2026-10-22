import { C2S, DAY_MS, formatDuration, formatNumber, questDef, questProgress, type QuestBook, utcDay, utcWeek } from '@game/shared'
import { useState } from 'react'

import { playSfx } from '../../audio/sfx'
import { send } from '../../net/connection'
import { useGame } from '../../state/gameStore'
import { ui } from '../../state/uiStore'
import { useServerClock } from '../hooks'
import { describeReward } from '../rewardText'
import { Tabs, Window } from '../Window'

type Period = 'daily' | 'weekly'

export function QuestsPanel() {
  const data = useGame((s) => s.data)
  const now = useServerClock(1000)
  const [tab, setTab] = useState<Period>('daily')
  if (!data) return null
  const book: QuestBook = tab === 'daily' ? data.dailyQuests : data.weeklyQuests
  const resetAt = tab === 'daily' ? (utcDay(now) + 1) * DAY_MS : ((utcWeek(now) + 1) * 7 - 3) * DAY_MS

  return (
    <Window
      title="Quests"
      onClose={() => ui().closePanel()}
      width={820}
      tabs={
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { id: 'daily', label: 'Daily' },
            { id: 'weekly', label: 'Weekly' },
          ]}
        />
      }
    >
      <div className="body-text mb-3 text-[16px]">New quests in {formatDuration((resetAt - now) / 1000)}</div>
      {book.quests.map((q) => {
        const def = questDef(q.id)
        if (!def) return null
        const { value, target } = questProgress(data, book, q.id)
        const done = value >= target
        return (
          <div key={q.id} className="list-row flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="txt-outline text-[28px]">{def.title}</div>
              <div className="progress mt-2" style={{ width: '100%', maxWidth: 420, height: 28 }}>
                <div className="fill" style={{ width: `${(value / target) * 100}%`, background: done ? 'linear-gradient(180deg,#5dff8a,#1fbf5a)' : undefined }} />
                <div className="text txt-outline" style={{ fontSize: 18 }}>
                  {formatNumber(value)} / {formatNumber(target)}
                </div>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3">
                {describeReward(def.reward, data).map((l) => (
                  <span key={l.text} className="txt-outline text-[16px]" style={{ color: l.color }}>
                    {l.text}
                  </span>
                ))}
              </div>
            </div>
            {q.claimed ? (
              <span className="txt-outline text-[24px]" style={{ color: '#9aa3b5' }}>
                CLAIMED
              </span>
            ) : (
              <button
                type="button"
                className="btn3d buy-btn bg-green"
                disabled={!done}
                onClick={() => {
                  playSfx('click')
                  send(C2S.claimQuest, { id: q.id })
                }}
              >
                <span className="txt-outline">{done ? 'CLAIM!' : 'In progress'}</span>
              </button>
            )}
          </div>
        )
      })}
    </Window>
  )
}
