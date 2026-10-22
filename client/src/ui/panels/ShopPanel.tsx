import {
  BOOMERANGS,
  boomerangPower,
  C2S,
  formatNumber,
  VIP_BOOMERANG,
} from '@game/shared'
import { useEffect, useRef } from 'react'

import { playSfx } from '../../audio/sfx'
import { send } from '../../net/connection'
import { useGame } from '../../state/gameStore'
import { ui } from '../../state/uiStore'
import { BoomerangIcon, LockIcon, TrophyIcon } from '../icons'
import { Window } from '../Window'

/** Boomerang shop: bought strictly in order, kept through Rebirth, best one auto-equipped. */
export function ShopPanel() {
  const data = useGame((s) => s.data)
  const wins = useGame((s) => s.wins)
  const nextRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    nextRef.current?.scrollIntoView({ block: 'center' })
  }, [])
  if (!data) return null
  const owned = data.boomerangsOwned

  return (
    <Window title="Boomerangs" onClose={() => ui().closePanel()}>
      <div className="body-text mb-3 text-center text-[18px]">
        Equipped gives <b>+{formatNumber(boomerangPower(data))} Power</b> per click. Owned boomerangs stay through Rebirth.
      </div>
      {data.vipBoomerang && (
        <div className="list-row highlight">
          <BoomerangIcon size={60} color={VIP_BOOMERANG.color} />
          <div className="flex-1">
            <div className="txt-outline text-[32px]" style={{ color: VIP_BOOMERANG.color }}>
              {VIP_BOOMERANG.name}
            </div>
            <div className="body-text text-[16px]">Always {VIP_BOOMERANG.multiplier}x stronger than your best boomerang.</div>
          </div>
          <span className="btn3d buy-btn bg-green">
            <span className="txt-outline">EQUIPPED</span>
          </span>
        </div>
      )}
      {BOOMERANGS.map((b) => {
        const isOwned = b.id < owned
        const isBest = b.id === owned - 1 && !data.vipBoomerang
        const isNext = b.id === owned
        return (
          <div key={b.id} ref={isNext ? nextRef : undefined} className={`list-row ${isNext ? 'highlight' : ''}`} style={{ opacity: b.id > owned ? 0.6 : 1 }}>
            <BoomerangIcon size={60} color={b.color} style={b.glow > 0.4 ? { filter: `drop-shadow(0 0 8px ${b.color})` } : undefined} />
            <div className="min-w-0 flex-1">
              <div className="txt-outline truncate text-[32px]" style={{ color: b.color }}>
                {b.name}
              </div>
              <div className="txt-outline text-[20px]" style={{ color: '#5fd3ff' }}>
                +{formatNumber(b.power)} Power / click
              </div>
            </div>
            <div className="flex w-[200px] justify-end">
              {isBest ? (
                <span className="btn3d buy-btn bg-green">
                  <span className="txt-outline">EQUIPPED</span>
                </span>
              ) : isOwned ? (
                <span className="txt-outline text-[26px]" style={{ color: '#9cff6b' }}>
                  OWNED
                </span>
              ) : isNext ? (
                <button
                  type="button"
                  className="btn3d buy-btn bg-green"
                  disabled={wins < b.cost}
                  onClick={() => {
                    playSfx('click')
                    send(C2S.buyBoomerang)
                  }}
                >
                  <TrophyIcon size={34} />
                  <span className="txt-outline">{formatNumber(b.cost)}</span>
                </button>
              ) : (
                <span className="flex items-center gap-2">
                  <LockIcon size={30} />
                  <span className="txt-outline text-[24px]">{formatNumber(b.cost)}</span>
                </span>
              )}
            </div>
          </div>
        )
      })}
    </Window>
  )
}
