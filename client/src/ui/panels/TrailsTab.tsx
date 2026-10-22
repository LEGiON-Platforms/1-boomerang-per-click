import { C2S, formatNumber, type TrailDef, TRAILS, TUTORIAL, TUTORIAL_STEPS } from '@game/shared'
import { useEffect, useRef } from 'react'

import { playSfx } from '../../audio/sfx'
import { send } from '../../net/connection'
import { useGame } from '../../state/gameStore'
import { HandIcon, TrophyIcon } from '../icons'

/** The flight path drawn in every preview: from the thrower (left) to the boomerang (right). */
const CURVE = 'M8 60 Q44 2 112 18'
const HELIX_A = 'M8 60 C20 40 30 56 40 34 S60 30 66 20 S90 22 112 18'
const HELIX_B = 'M8 60 C24 54 26 34 40 40 S58 16 66 26 S92 8 112 18'
const RAINBOW = ['#ff3b3b', '#ffb13b', '#fff23b', '#3bff6a', '#3bd1ff', '#6a3bff', '#ff3bd6']

/** A four-pointed sparkle centred on (x, y). */
const star = (x: number, y: number, r: number) => {
  const q = r * 0.28
  return `M${x} ${y - r}L${x + q} ${y - q}L${x + r} ${y}L${x + q} ${y + q}L${x} ${y + r}L${x - q} ${y + q}L${x - r} ${y}L${x - q} ${y - q}Z`
}

function Line({ d, w, stroke, opacity, dash }: { d: string; w: number; stroke: string; opacity?: number; dash?: string }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
      strokeDasharray={dash}
    />
  )
}

/** The white-hot core along the middle of a trail. */
const Core = ({ d, w = 2 }: { d: string; w?: number }) => <Line d={d} w={w} stroke="#ffffff" opacity={0.85} />

/** Style-specific shapes (stroked with the trail's gradient `grad`). */
function TrailShape({ t, grad }: { t: TrailDef; grad: string }) {
  const [head, tail] = t.colors
  switch (t.style) {
    case 'breeze':
      return (
        <>
          <Line d={CURVE} w={4} stroke={grad} />
          <Line d="M18 62 Q50 14 104 24" w={2} stroke={head} opacity={0.7} dash="7 9" />
          <Line d="M12 52 Q40 0 100 12" w={1.5} stroke={head} opacity={0.6} dash="5 11" />
        </>
      )
    case 'bubbles':
      return (
        <>
          <Line d={CURVE} w={7} stroke={grad} />
          <Core d={CURVE} />
          {[
            [28, 36, 5],
            [48, 18, 3.5],
            [70, 10, 5.5],
            [40, 46, 3],
            [88, 30, 4],
          ].map(([x, y, r]) => (
            <g key={x}>
              <circle cx={x} cy={y} r={r} fill={head} fillOpacity={0.15} stroke={head} strokeWidth={1.8} />
              <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.25} fill="#fff" />
            </g>
          ))}
        </>
      )
    case 'zap': {
      const d = 'M8 60 L22 44 L28 50 L40 30 L48 36 L62 18 L72 24 L88 12 L96 18 L112 18'
      return (
        <>
          <Line d={d} w={5} stroke={grad} />
          <Core d={d} w={1.6} />
        </>
      )
    }
    case 'wave': {
      const d = 'M8 60 C18 40 28 58 38 38 S56 30 64 22 S84 26 90 14 S106 22 112 18'
      return (
        <>
          <Line d={d} w={7} stroke={grad} />
          <Core d={d} />
        </>
      )
    }
    case 'comet':
      return (
        <>
          <path d="M6 64 Q46 6 114 10 L114 27 Q50 22 6 64 Z" fill={grad} />
          <Core d="M30 48 Q60 16 112 18" w={3} />
        </>
      )
    case 'helix':
      return (
        <>
          <Line d={HELIX_A} w={4} stroke={head} />
          <Line d={HELIX_B} w={4} stroke={tail} />
          <Core d={HELIX_A} w={1.2} />
        </>
      )
    case 'sparkle':
      return (
        <>
          <Line d={CURVE} w={7} stroke={grad} />
          <Core d={CURVE} />
          {[
            [30, 30, 6],
            [58, 8, 5],
            [80, 28, 7],
            [44, 50, 4],
          ].map(([x, y, r]) => (
            <path key={x} d={star(x, y, r)} fill="#fff" stroke={head} strokeWidth={1} />
          ))}
        </>
      )
    case 'flame':
      return (
        <>
          <path d="M6 64 Q46 6 114 12 L114 26 Q50 24 6 64 Z" fill={grad} />
          {[
            [34, 38],
            [56, 22],
            [80, 14],
          ].map(([x, y]) => (
            <path key={x} d={`M${x} ${y}q5 -9 1 -17q-8 7 -1 17z`} fill={head} />
          ))}
          <Core d="M34 44 Q62 16 112 19" w={2.5} />
        </>
      )
    case 'aurora':
      return (
        <>
          <Line d={CURVE} w={15} stroke={grad} opacity={0.85} />
          <Core d="M8 60 C18 40 28 50 40 32 S70 20 112 18" w={2.5} />
        </>
      )
    case 'nebula':
      return (
        <>
          <Line d={CURVE} w={20} stroke={grad} opacity={0.55} />
          <Line d={CURVE} w={8} stroke={grad} />
          {[
            [26, 44],
            [46, 22],
            [64, 30],
            [84, 8],
            [96, 26],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r={1.8} fill="#fff" />
          ))}
        </>
      )
    case 'rainbow':
      return (
        <>
          <Line d={CURVE} w={10} stroke={grad} />
          <Core d={CURVE} />
        </>
      )
    case 'cosmic':
      return (
        <>
          <Line d={HELIX_A} w={4} stroke={grad} />
          <Line d={HELIX_B} w={4} stroke={grad} />
          <Core d={CURVE} w={1.5} />
          {[
            [36, 36, 5],
            [66, 14, 6],
            [92, 30, 4],
          ].map(([x, y, r]) => (
            <path key={x} d={star(x, y, r)} fill="#fff" />
          ))}
        </>
      )
  }
}

/** The glowing flight-path preview drawn in each row, in the trail's own style. */
export function TrailPreview({ t }: { t: TrailDef }) {
  const id = `tr${t.id}`
  const stops =
    t.style === 'rainbow' || t.style === 'cosmic'
      ? RAINBOW.map((c, i) => <stop key={c} offset={i / (RAINBOW.length - 1)} stopColor={c} />)
      : t.style === 'aurora'
        ? [t.colors[1], t.colors[0], t.colors[1], t.colors[0]].map((c, i) => <stop key={i} offset={i / 3} stopColor={c} />)
        : [<stop key="a" offset="0" stopColor={t.colors[1]} stopOpacity="0.3" />, <stop key="b" offset="1" stopColor={t.colors[0]} />]
  const grad = `url(#${id}g)`
  return (
    <svg viewBox="0 0 130 70" width={136} height={74} className="shrink-0 rounded-[10px]" style={{ background: '#0d0e14' }}>
      <defs>
        <linearGradient id={`${id}g`} x1="0" x2="1">
          {stops}
        </linearGradient>
        <radialGradient id={`${id}a`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.35" stopColor={t.glow} stopOpacity="0.8" />
          <stop offset="1" stopColor={t.glow} stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}f`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
      </defs>
      {/* A soft blurred copy under the trail, the trail itself, then the boomerang in its aura. */}
      <g filter={`url(#${id}f)`} opacity={0.9}>
        <TrailShape t={t} grad={grad} />
      </g>
      <TrailShape t={t} grad={grad} />
      <circle cx="113" cy="18" r="17" fill={`url(#${id}a)`} />
      <path d="M104 9 Q116 10 123 19 Q113 17 105 27 Q109 18 104 9 Z" fill="#8a5530" stroke="#1b1b22" strokeWidth="2.5" strokeLinejoin="round" />
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

/** Shop tab: trails multiply Power and draw a glowing path behind thrown boomerangs and your walk. */
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
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <TrailPreview t={t} />
              <div className="flex min-w-0 flex-col">
                <span className="txt-outline truncate text-[34px]" style={{ color: t.colors[0] }}>
                  {t.name} Trail
                </span>
                <span className="txt-outline truncate text-[20px]" style={{ color: t.glow }}>
                  ✦ {t.styleName}
                </span>
              </div>
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
