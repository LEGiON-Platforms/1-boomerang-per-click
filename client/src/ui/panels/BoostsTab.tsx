import { C2S, formatNumber, formatOfferClock, GEM_SHOP, type GemItemId, starterPackSecondsLeft } from '@game/shared'
import type { ReactNode } from 'react'

import { playSfx } from '../../audio/sfx'
import { send } from '../../net/connection'
import { useGame } from '../../state/gameStore'
import { ui } from '../../state/uiStore'
import { useServerClock } from '../hooks'
import { BoomerangIcon, GemIcon, PowerBurstIcon, TrophyIcon } from '../icons'
import { Num } from '../Num'

function buyGem(item: GemItemId, blurb: string) {
  const def = GEM_SHOP[item]
  playSfx('click')
  ui().ask(def.name, `${blurb} Costs ${def.cost} gems.`, `Buy for ${def.cost}`, () => send(C2S.buyGemItem, { item }))
}

interface OfferRowProps {
  item: GemItemId
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
  const gems = useGame((s) => s.data?.gems ?? 0)
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
          <button type="button" className="btn3d buy-btn bg-purple" disabled={gems < GEM_SHOP[item].cost} onClick={() => buyGem(item, blurb)}>
            <GemIcon size={30} />
            <span className="txt-outline">{GEM_SHOP[item].cost}</span>
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
      blurb="A free Blue Block pet plus 30 minutes of 2x Wins and 3x Click Power."
      owned={false}
      extra={
        <div className="txt-outline mt-1 text-[20px]" style={{ color: '#ff5d5d' }}>
          Ends in <Num value={formatOfferClock(left)} />
        </div>
      }
    />
  )
}

/** Shop tab — permanent gem upgrades and the limited Starter Pack. */
export function BoostsTab() {
  const data = useGame((s) => s.data)
  if (!data) return null
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="txt-outline flex items-center gap-2 text-[30px]">
          <GemIcon size={36} /> <Num value={formatNumber(data.gems)} style={{ color: '#5ff0c8' }} /> Gems
        </span>
        <span className="body-text text-[15px] opacity-80">Earn gems from Daily Rewards, Quests and Codes (in Settings).</span>
      </div>
      <StarterPackRow />
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
      <OfferRow
        item="autoWin"
        icon={<BoomerangIcon size={64} />}
        title="Auto Win"
        color="#ff6b6b"
        blurb="Walks and breaks your current stage for you, forever."
        owned={data.perks.autoWin}
        ownedAction={<AutoWinSwitch />}
      />
    </>
  )
}
