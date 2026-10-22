import { formatNumber, RARITY, TUTORIAL_REWARDS } from '@game/shared'
import { useEffect, useRef, useState } from 'react'

import { playSfx } from '../../audio/sfx'
import { useUI } from '../../state/uiStore'
import { GiftIcon, PowerBurstIcon, TrophyIcon } from '../icons'
import { describeSummary } from '../rewardText'

function PopupCard({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="overlay-center overlay-dim" style={{ zIndex: 50 }} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="window-scale">
        <div className="window studs" style={{ width: 'min(560px, calc(100vw - 32px))' }}>
          <div className="window-title txt-outline" style={{ fontSize: 48 }}>
            {title}
          </div>
          <div className="window-body flex flex-col items-center gap-3 text-center">{children}</div>
          <div className="flex justify-center pb-5">
            <button type="button" className="btn3d buy-btn bg-green" onClick={onClose}>
              <span className="txt-outline">Awesome!</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Rewards from gifts, daily, quests, codes and offers (waits for any egg reveal). */
export function RewardPopup() {
  const reward = useUI((s) => s.rewardQueue[0])
  const revealing = useUI((s) => s.eggQueue.length > 0)
  const shift = useUI((s) => s.shiftReward)
  if (!reward || revealing) return null
  const lines = describeSummary(reward.reward)
  return (
    <PopupCard title={reward.title} onClose={shift}>
      <GiftIcon size={84} />
      {lines.map((l) => (
        <div key={l.text} className="txt-outline text-[32px]" style={{ color: l.color }}>
          {l.text}
        </div>
      ))}
    </PopupCard>
  )
}

export function OfflinePopup() {
  const offline = useUI((s) => s.offline)
  const set = useUI((s) => s.set)
  if (!offline) return null
  const hours = Math.floor(offline.minutes / 60)
  const mins = offline.minutes % 60
  return (
    <PopupCard title="Welcome back!" onClose={() => set({ offline: null })}>
      <TrophyIcon size={84} />
      <div className="txt-outline text-[40px]" style={{ color: '#5dff7a' }}>
        +{formatNumber(offline.wins)} Wins
      </div>
      <div className="body-text text-[17px]">
        earned while you were away ({hours > 0 ? `${hours}h ` : ''}
        {mins}m)
      </div>
    </PopupCard>
  )
}

const CARD = 170
const REPEATS = 8

/** "Tutorial Complete! Rolling Your Tutorial Reward…" — a strip that lands on the server's roll. */
export function TutorialRoll() {
  const index = useUI((s) => s.tutorialRoll)
  const set = useUI((s) => s.set)
  const stripRef = useRef<HTMLDivElement>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (index === null) return
    setDone(false)
    const strip = stripRef.current
    if (!strip) return
    const target = (REPEATS - 2) * TUTORIAL_REWARDS.length + index
    const width = strip.parentElement?.clientWidth ?? 900
    strip.style.transition = 'none'
    strip.style.transform = 'translateX(0px)'
    void strip.offsetWidth
    strip.style.transition = 'transform 3.6s cubic-bezier(0.08, 0.7, 0.12, 1)'
    strip.style.transform = `translateX(${-(target * CARD) + width / 2 - CARD / 2}px)`
    playSfx('lucky')
    const t1 = window.setTimeout(() => {
      setDone(true)
      playSfx('reveal')
    }, 3700)
    const t2 = window.setTimeout(() => set({ tutorialRoll: null }), 6200)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [index, set])

  if (index === null) return null
  const won = TUTORIAL_REWARDS[index]
  return (
    <div className="overlay-center" style={{ zIndex: 50, background: 'rgba(8,10,20,0.35)' }}>
      <div className="flex w-full flex-col items-center gap-3">
        <div className="objective-title-big txt-outline text-[64px]" style={{ color: '#d8ff3a' }}>
          Tutorial Complete!
        </div>
        <div className="txt-outline text-[40px]">{done ? `You got ${won.label} ${won.boost.minutes} min!` : 'Rolling Your Tutorial Reward…'}</div>
        <div className="relative w-[min(900px,92vw)] overflow-hidden rounded-xl border-4 border-[#1b1b22] bg-black/50 py-3">
          <div ref={stripRef} className="flex gap-[10px] px-[5px]" style={{ width: CARD * TUTORIAL_REWARDS.length * REPEATS }}>
            {Array.from({ length: REPEATS }).flatMap((_, rep) =>
              TUTORIAL_REWARDS.map((o, i) => (
                <div
                  key={`${rep}-${i}`}
                  className="flex shrink-0 flex-col items-center justify-center rounded-xl border-4 bg-[#1a1c24]"
                  style={{ width: CARD - 10, height: 170, borderColor: RARITY[o.rarity].color }}
                >
                  <PowerBurstIcon size={56} />
                  <span className="txt-outline text-center text-[24px]">{o.label}</span>
                  <span className="txt-outline text-[18px]">{o.boost.minutes} min</span>
                  <span className="txt-outline text-[18px]" style={{ color: RARITY[o.rarity].color }}>
                    {RARITY[o.rarity].name}
                  </span>
                </div>
              )),
            )}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[4px] -translate-x-1/2 bg-[#ffe14a]" />
        </div>
      </div>
    </div>
  )
}
