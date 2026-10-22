import {
  C2S,
  dailyCanClaim,
  dailyNextDay,
  formatNumber,
  formatOfferClock,
  formatTimer,
  GEM_SHOP,
  type GemItemId,
  PLAYTIME_GIFTS,
  questProgress,
  rebirthCost,
  starterPackSecondsLeft,
} from '@game/shared'
import type { ReactNode } from 'react'

import { playSfx } from '../../audio/sfx'
import { send } from '../../net/connection'
import { useGame } from '../../state/gameStore'
import { type PanelId, ui } from '../../state/uiStore'
import { useServerClock } from '../hooks'
import { CalendarIcon, CodeIcon, FriendsIcon, GearIcon, GemIcon, GiftIcon, PowerBurstIcon, TimerIcon, TrophyIcon } from '../icons'

function buyGem(item: GemItemId, blurb: string) {
  const def = GEM_SHOP[item]
  playSfx('click')
  ui().ask(def.name, `${blurb} Costs ${def.cost} gems.`, `Buy for ${def.cost}`, () => send(C2S.buyGemItem, { item }))
}

function OfferButton({ item, color, title, sub, icon, blurb }: { item: GemItemId; color: string; title: string; sub?: string; icon: ReactNode; blurb: string }) {
  const owned = useGame((s) => (item === 'starterPack' ? false : (s.data?.perks[item] ?? false)))
  return (
    <button type="button" className={`btn3d studs offer-btn ${color} relative`} onClick={() => !owned && buyGem(item, blurb)}>
      <span className="absolute -top-7 left-1/2 -translate-x-1/2">{icon}</span>
      <span className="txt-outline mt-2 text-[38px]">{title}</span>
      {owned ? (
        <span className="txt-outline text-[24px]" style={{ color: '#7dff6b' }}>
          OWNED
        </span>
      ) : (
        <span className="price-tag">
          ONLY {GEM_SHOP[item].cost} <GemIcon size={26} />
        </span>
      )}
      {sub && !owned && <span className="txt-outline absolute -bottom-6 text-[24px]" style={{ color: '#ffe14a' }}>{sub}</span>}
    </button>
  )
}

function StarterPack() {
  const data = useGame((s) => s.data)
  const now = useServerClock(50)
  const left = data ? starterPackSecondsLeft(data, now) : 0
  if (left <= 0) return null
  return (
    <button
      type="button"
      className="relative flex w-[210px] flex-col items-center"
      onClick={() => buyGem('starterPack', 'A free Blue Block pet plus 30 minutes of 2x Wins and 3x Click Power.')}
    >
      <span className="txt-outline text-[28px]">Starter Pack</span>
      <span className="my-1 grid h-[86px] w-[86px] place-items-center rounded-full border-4 border-[#1b1b22] bg-linear-to-b from-[#ff8ad8] to-[#b04dff]">
        <span className="txt-outline text-[36px]">2x</span>
      </span>
      <span className="price-tag" style={{ fontSize: 32 }}>
        ONLY {GEM_SHOP.starterPack.cost} <GemIcon size={30} />
      </span>
      <span className="txt-outline text-[24px]" style={{ color: '#ff4d4d' }}>
        {formatOfferClock(left)}
      </span>
    </button>
  )
}

export function HudOffers() {
  return (
    <div className="hud-group hud-r flex flex-col items-end gap-9">
      <StarterPack />
      <OfferButton
        item="power2x"
        color="bg-orange"
        title="2x Power"
        icon={<PowerBurstIcon size={56} />}
        blurb="Permanently doubles all the Power you gain."
      />
      <OfferButton
        item="wins2x"
        color="bg-yellow"
        title="2x Wins"
        sub="Permanent!"
        icon={<TrophyIcon size={52} />}
        blurb="Permanently doubles every Win you earn."
      />
    </div>
  )
}

function TopIcon({ panel, icon, caption, alert }: { panel: PanelId; icon: ReactNode; caption?: string; alert?: boolean }) {
  return (
    <button
      type="button"
      className="top-icon"
      onClick={() => {
        playSfx('click')
        ui().togglePanel(panel)
      }}
    >
      {icon}
      {alert && <span className="badge-alert txt-outline">!</span>}
      {caption && (
        <span className="caption txt-outline" style={{ color: caption === 'CLAIM!' ? '#ffe14a' : '#fff' }}>
          {caption}
        </span>
      )}
    </button>
  )
}

export function HudTopRight() {
  const data = useGame((s) => s.data)
  const syncedAt = useGame((s) => s.syncedAt)
  const wins = useGame((s) => s.wins)
  const now = useServerClock(1000)
  if (!data) return null

  // Playtime advances locally between server syncs.
  const playSeconds = data.playtime.seconds + Math.max(0, (Date.now() - syncedAt) / 1000)
  const unclaimed = PLAYTIME_GIFTS.findIndex((_g, i) => !data.playtime.claimed.includes(i))
  const giftReady = PLAYTIME_GIFTS.some((g, i) => !data.playtime.claimed.includes(i) && playSeconds >= g.minutes * 60)
  const nextGift = unclaimed >= 0 ? PLAYTIME_GIFTS[unclaimed] : null
  const giftCaption = giftReady ? 'CLAIM!' : nextGift ? formatTimer(nextGift.minutes * 60 - playSeconds) : 'DONE'

  const dailyReady = dailyCanClaim(data, now)
  const questReady = [data.dailyQuests, data.weeklyQuests].some((book) =>
    book.quests.some((q) => {
      if (q.claimed) return false
      const p = questProgress(data, book, q.id)
      return p.value >= p.target
    }),
  )

  const cost = rebirthCost(data.rebirths)
  const pct = Math.min(1, wins / cost)

  return (
    <div className="hud-group hud-tr flex flex-col items-end gap-5">
      <div className="flex gap-2">
        <TopIcon panel="gifts" icon={<TimerIcon size={54} />} caption={giftCaption} alert={giftReady} />
        <TopIcon panel="daily" icon={<CalendarIcon size={54} day={dailyNextDay(data, now)} />} caption={dailyReady ? 'CLAIM!' : undefined} alert={dailyReady} />
        <TopIcon panel="codes" icon={<CodeIcon size={54} />} />
        <TopIcon panel="friends" icon={<FriendsIcon size={54} />} />
        <TopIcon panel="quests" icon={<GiftIcon size={54} />} alert={questReady} />
        <TopIcon panel="settings" icon={<GearIcon size={54} />} />
      </div>
      <div className="mt-2 w-[270px] rounded-lg border-4 border-[#1b1b22] bg-black/40 px-2 pb-2 pt-1">
        <div className="txt-outline text-center text-[22px]">
          Next Rebirth: <span style={{ color: '#ff7ad9' }}>x{data.rebirths + 2}</span> <span style={{ color: '#5fd3ff' }}>Power</span>
        </div>
        <div className="progress mt-1" style={{ width: '100%', height: 26 }}>
          <div className="fill" style={{ width: `${pct * 100}%`, background: 'linear-gradient(180deg,#ffb13b,#ff7a00)' }} />
          <div className="text txt-outline" style={{ fontSize: 18 }}>
            <span className="flex items-center gap-1">
              <TrophyIcon size={16} /> {formatNumber(wins)} / {formatNumber(cost)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
