import { C2S, formatNumber, formatOfferClock, PERK_SHOP, type PerkId, starterPackSecondsLeft } from '@game/shared'
import type { ReactNode } from 'react'

import { playSfx } from '../../audio/sfx'
import { send } from '../../net/connection'
import { useGame } from '../../state/gameStore'
import { ui } from '../../state/uiStore'
import { useServerClock } from '../hooks'
import { BoomerangIcon, PowerBurstIcon, TrophyIcon } from '../icons'
import { Num } from '../Num'

function buyPerk(item: PerkId, blurb: string) {
  const def = PERK_SHOP[item]
  playSfx('click')
  const price = formatNumber(def.cost)
  ui().ask(def.name, `${blurb} Costs ${price} Wins.`, `Buy for ${price}`, () => send(C2S.buyPerk, { item }))
}

interface OfferRowProps {
  item: PerkId
  icon: ReactNode
  title: string
  color: string
  blurb: string
  owned: boolean
  /** Shown instead of OWNED once bought (the Auto Win switch). */
  ownedAction?: ReactNode
  extra?: ReactNode
}

function OfferRow({ item, icon, title, color, blurb, owned, ownedAction, extra }: OfferRowProps) {
  const cost = PERK_SHOP[item].cost
  const affordable = useGame((s) => s.wins >= cost)
  return (
    <div className="list-row">
      <div className="grid w-[76px] place-items-center">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="txt-outline text-[32px]" style={{ color }}>
          {title}
        </div>
        <div className="body-text text-[16px]">{blurb}</div>
        {extra}
      </div>
      <div className="flex w-[200px] justify-end">
        {owned ? (
          (ownedAction ?? (
            <span className="txt-outline text-[26px]" style={{ color: '#9cff6b' }}>
              OWNED
            </span>
          ))
        ) : (
          <button type="button" className="btn3d buy-btn bg-green" disabled={!affordable} onClick={() => buyPerk(item, blurb)}>
            <TrophyIcon size={34} />
            <span className="txt-outline">{formatNumber(cost)}</span>
          </button>
        )}
      </div>
    </div>
  )
}

function AutoWinSwitch() {
  const on = useGame((s) => s.autoWin)
  return (
    <button
      type="button"
      className={`btn3d buy-btn ${on ? 'bg-green' : 'bg-dark'}`}
      onClick={() => {
        playSfx('click')
        useGame.getState().set({ autoWin: !on })
      }}
    >
      <span className="txt-outline">{on ? 'ON' : 'OFF'}</span>
    </button>
  )
}

function StarterPackRow() {
  const data = useGame((s) => s.data)
  const now = useServerClock(1000)
  const left = data ? starterPackSecondsLeft(data, now) : 0
  if (left <= 0) return null
  return (
    <OfferRow
      item="starterPack"
      icon={
        <span className="grid h-[68px] w-[68px] place-items-center rounded-full border-4 border-[#1b1b22] bg-linear-to-b from-[#ff8ad8] to-[#b04dff]">
          <span className="txt-outline text-[28px]">2x</span>
        </span>
      }
      title="Starter Pack"
      color="#ff8ae2"
      blurb="30 minutes of 2x Wins and 3x Click Power, for new players."
      owned={false}
      extra={
        <div className="txt-outline mt-1 text-[20px]" style={{ color: '#ff5d5d' }}>
          Ends in <Num value={formatOfferClock(left)} />
        </div>
      }
    />
  )
}

/** Shop tab — permanent upgrades bought with Wins, and the limited Starter Pack. */
export function BoostsTab() {
  const data = useGame((s) => s.data)
  if (!data) return null
  return (
    <>
      <StarterPackRow />
      <OfferRow
        item="autoWin"
        icon={<BoomerangIcon size={64} />}
        title="Auto Win"
        color="#ff6b6b"
        blurb="Walks and breaks your current stage for you, forever."
        owned={data.perks.autoWin}
        ownedAction={<AutoWinSwitch />}
      />
      <OfferRow
        item="power2x"
        icon={<PowerBurstIcon size={64} />}
        title="2x Power"
        color="#ffb13b"
        blurb="Permanently doubles all the Power you gain."
        owned={data.perks.power2x}
      />
      <OfferRow
        item="wins2x"
        icon={<TrophyIcon size={58} />}
        title="2x Wins"
        color="#ffd21f"
        blurb="Permanently doubles every Win you earn."
        owned={data.perks.wins2x}
      />
    </>
  )
}
