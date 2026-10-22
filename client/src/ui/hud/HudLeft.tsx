import { C2S, formatNumber, GEM_SHOP, rebirthCost } from '@game/shared'
import type { ReactNode } from 'react'

import { playSfx } from '../../audio/sfx'
import { send } from '../../net/connection'
import { useGame } from '../../state/gameStore'
import { type PanelId, ui, useUI } from '../../state/uiStore'
import { BackpackIcon, GemIcon, PumpkinIcon, RebirthIcon, ShopIcon, TrailsIcon, TrophyIcon } from '../icons'

function CurrencyRow({ icon, value }: { icon: ReactNode; value: number }) {
  return (
    <div className="currency-row">
      <div className="flex w-[74px] justify-center">{icon}</div>
      <span className="value txt-outline">{formatNumber(value)}</span>
    </div>
  )
}

interface MenuBtnProps {
  panel: PanelId
  label: string
  color: string
  icon: ReactNode
  corner?: ReactNode
}

function MenuBtn({ panel, label, color, icon, corner }: MenuBtnProps) {
  const open = useUI((s) => s.panel === panel)
  return (
    <button
      type="button"
      className={`btn3d studs menu-btn ${color}`}
      style={open ? { outline: '4px solid #fff', outlineOffset: 2 } : undefined}
      onClick={() => {
        playSfx('click')
        ui().togglePanel(panel)
      }}
    >
      <span className="icon">{icon}</span>
      <span className="label txt-outline">{label}</span>
      {corner}
    </button>
  )
}

function AutoWinButton() {
  const owned = useGame((s) => s.data?.perks.autoWin ?? false)
  const on = useGame((s) => s.autoWin)
  const onClick = () => {
    playSfx('click')
    if (owned) {
      useGame.getState().set({ autoWin: !on })
      return
    }
    const item = GEM_SHOP.autoWin
    ui().ask(
      'Auto Win',
      `Walk and break your current stage automatically, forever. Costs ${item.cost} gems.`,
      `Buy for ${item.cost}`,
      () => send(C2S.buyGemItem, { item: 'autoWin' }),
    )
  }
  return (
    <button type="button" className="btn3d studs bg-red relative mt-3 flex h-[74px] w-[268px] flex-col items-center justify-center" onClick={onClick}>
      <span className="txt-outline text-[36px]">Auto Win</span>
      {owned ? null : (
        <span className="price-tag" style={{ fontSize: 22 }}>
          ONLY {GEM_SHOP.autoWin.cost} <GemIcon size={22} />
        </span>
      )}
      <span className="txt-outline absolute -right-4 -top-4 text-[24px]" style={{ color: on ? '#7dff6b' : '#fff' }}>
        {on ? 'ON' : 'OFF'}
      </span>
    </button>
  )
}

export function HudLeft() {
  const rebirths = useGame((s) => s.data?.rebirths ?? 0)
  const pumpkins = useGame((s) => s.data?.pumpkins ?? 0)
  const wins = useGame((s) => s.wins)
  const pct = Math.min(100, Math.floor((wins / rebirthCost(rebirths)) * 100))

  return (
    <div className="hud-group hud-l hud-left-col">
      <div className="flex flex-col gap-2">
        <CurrencyRow icon={<RebirthIcon size={60} />} value={rebirths} />
        <CurrencyRow icon={<PumpkinIcon size={56} />} value={pumpkins} />
        <CurrencyRow icon={<TrophyIcon size={56} />} value={wins} />
      </div>
      <div className="mt-4 grid w-[270px] grid-cols-2 gap-3">
        <MenuBtn panel="trails" label="Trails" color="bg-cyan" icon={<TrailsIcon size={66} />} />
        <MenuBtn
          panel="shop"
          label="Shop"
          color="bg-red"
          icon={<ShopIcon size={66} />}
          corner={
            <span className="badge-corner txt-outline" style={{ color: '#ffe14a' }}>
              OP!
            </span>
          }
        />
        <MenuBtn panel="items" label="Items" color="bg-orange" icon={<BackpackIcon size={66} />} />
        <MenuBtn
          panel="rebirth"
          label="Rebirth"
          color="bg-magenta"
          icon={<RebirthIcon size={66} />}
          corner={
            <span className="badge-corner txt-outline" style={{ fontSize: 22, left: -10, right: 'auto', top: -10, transform: 'rotate(-10deg)' }}>
              {pct}%
            </span>
          }
        />
      </div>
      <AutoWinButton />
    </div>
  )
}
