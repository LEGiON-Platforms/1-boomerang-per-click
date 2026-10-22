import { C2S, formatNumber, TRAILS, TUTORIAL, TUTORIAL_STEPS } from '@game/shared'
import { useEffect, useRef } from 'react'

import { playSfx } from '../../audio/sfx'
import { send } from '../../net/connection'
import { useGame } from '../../state/gameStore'
import { HandIcon, TrophyIcon } from '../icons'

/** The swoosh preview drawn in each row, in the trail's own gradient. */
export function TrailSwoosh({ colors, id }: { colors: readonly [string, string]; id: number }) {
  return (
    <svg viewBox="0 0 100 60" width={96} height={58}>
      <defs>
        <linearGradient id={`tr${id}`} x1="0" x2="1">
          <stop offset="0" stopColor={colors[1]} stopOpacity="0.2" />
          <stop offset="1" stopColor={colors[0]} />
        </linearGradient>
      </defs>
      <path d="M8 52 Q30 8 78 14" fill="none" stroke={`url(#tr${id})`} strokeWidth="14" strokeLinecap="round" />
      <path d="M70 6 L92 14 L80 30 Z" fill="#8a5530" stroke="#1b1b22" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  )
}

/** Shown under the Trails tab while the tutorial asks for the first trail. */
export function TrailsTutorialFooter() {
  return (
    <div className="txt-outline flex items-center justify-center gap-3 text-[40px]" style={{ color: '#9cff3a' }}>
      Click to buy! <HandIcon size={46} />
    </div>
  )
}

/** Shop tab: trails multiply Power and draw a ribbon behind thrown boomerangs. */
export function TrailsTab() {
  const data = useGame((s) => s.data)
  const wins = useGame((s) => s.wins)
  const highlightRef = useRef<HTMLDivElement>(null)
  const tutorial = data?.tutorialStep === TUTORIAL_STEPS.buyTrail

  useEffect(() => {
    highlightRef.current?.scrollIntoView({ block: 'center' })
  }, [tutorial])

  if (!data) return null
  return (
    <>
      {TRAILS.map((t) => {
        const owned = data.trailsOwned.includes(t.id)
        const equipped = data.equippedTrail === t.id
        const affordable = wins >= t.cost
        const highlight = tutorial && t.id === TUTORIAL.trailId
        return (
          <div key={t.id} ref={highlight ? highlightRef : undefined} className={`list-row ${highlight ? 'highlight' : ''}`}>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="txt-outline truncate text-[34px]" style={{ color: t.colors[0] }}>
                {t.name} Trail
              </span>
              <TrailSwoosh colors={t.colors} id={t.id} />
            </div>
            <div className="mult-box">
              <div className="big txt-outline">x{t.mult.toFixed(2).replace(/0$/, '')}</div>
              <div className="small txt-outline">POWER</div>
            </div>
            <div className="flex w-[200px] justify-end">
              {equipped ? (
                <span className="btn3d buy-btn bg-green">
                  <span className="txt-outline">EQUIPPED</span>
                </span>
              ) : owned ? (
                <button
                  type="button"
                  className="btn3d buy-btn bg-cyan"
                  onClick={() => {
                    playSfx('click')
                    send(C2S.equipTrail, { id: t.id })
                  }}
                >
                  <span className="txt-outline">Equip</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="btn3d buy-btn bg-green"
                  disabled={!affordable}
                  onClick={() => {
                    playSfx('click')
                    send(C2S.buyTrail, { id: t.id })
                  }}
                >
                  <TrophyIcon size={34} />
                  <span className="txt-outline">{formatNumber(t.cost)}</span>
                </button>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}
