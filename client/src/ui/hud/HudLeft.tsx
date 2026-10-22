import { formatNumber, rebirthProgressForXp, TUTORIAL_STEPS } from '@game/shared'
import type { ReactNode } from 'react'

import { playSfx } from '../../audio/sfx'
import { useGame } from '../../state/gameStore'
import { isShopTab, ui, useUI } from '../../state/uiStore'
import { PumpkinIcon, RebirthIcon, ShopIcon, TrophyIcon } from '../icons'
import { useGameThrottled } from '../hooks'
import { Num } from '../Num'

type GameState = ReturnType<typeof useGame.getState>

/** Each row subscribes to its own number, so a change re-renders only that row. */
function CurrencyRow({ icon, select, color, flyTarget }: { icon: ReactNode; select: (s: GameState) => number; color: string; flyTarget?: string }) {
  const value = Math.floor(useGameThrottled(select))
  return (
    <div className="currency-row">
      <div className="flex w-[74px] justify-center" data-fly-target={flyTarget}>
        {icon}
      </div>
      <Num value={formatNumber(value)} className="value txt-outline" style={{ color }} />
    </div>
  )
}

const selectRebirths = (s: GameState) => s.data?.rebirths ?? 0
const selectWins = (s: GameState) => s.wins
const selectPumpkins = (s: GameState) => s.data?.pumpkins ?? 0

const selectRebirthPct = (s: GameState) => Math.floor(rebirthProgressForXp(s.xp, s.data?.rebirths ?? 0) * 100)

function RebirthPercent() {
  const pct = useGameThrottled(selectRebirthPct)
  return (
    <span className="badge-corner txt-outline" style={{ fontSize: 22 }}>
      <Num value={`${pct}%`} />
    </span>
  )
}

function MenuBtn({ open, label, color, icon, corner, onClick }: { open: boolean; label: string; color: string; icon: ReactNode; corner?: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`btn3d studs menu-btn ${color} ${open ? 'is-open' : ''}`}
      onClick={() => {
        playSfx('click')
        onClick()
      }}
    >
      <span className="icon">{icon}</span>
      <span className="label txt-outline">{label}</span>
      {corner}
    </button>
  )
}

/** Shop holds Boomerangs, Trails, Items and Boosts. During the trail tutorial it opens on Trails. */
function ShopButton() {
  const open = useUI((s) => isShopTab(s.panel))
  const buyTrail = useGame((s) => s.data?.tutorialStep === TUTORIAL_STEPS.buyTrail)
  return (
    <MenuBtn
      open={open}
      label="Shop"
      color="bg-red"
      icon={<ShopIcon size={66} />}
      corner={
        buyTrail ? (
          <span className="badge-alert txt-outline">!</span>
        ) : (
          <span className="badge-corner badge-left txt-outline" style={{ color: '#ffe14a', fontSize: 26 }}>
            OP!
          </span>
        )
      }
      onClick={() => (open ? ui().closePanel() : ui().openPanel(buyTrail ? 'trails' : 'shop'))}
    />
  )
}

function RebirthButton() {
  const open = useUI((s) => s.panel === 'rebirth')
  return (
    <MenuBtn
      open={open}
      label="Rebirth"
      color="bg-magenta"
      icon={<RebirthIcon size={66} />}
      corner={<RebirthPercent />}
      onClick={() => ui().togglePanel('rebirth')}
    />
  )
}

export function HudLeft() {
  return (
    <div className="hud-group hud-l hud-left-col">
      <div className="currency-col flex flex-col gap-2">
        <CurrencyRow icon={<RebirthIcon size={60} />} select={selectRebirths} color="#ff8ae2" />
        <CurrencyRow icon={<TrophyIcon size={56} />} select={selectWins} color="#ffd21f" flyTarget="wins" />
        <CurrencyRow icon={<PumpkinIcon size={56} />} select={selectPumpkins} color="#ffa63d" />
      </div>
      <div className="mt-4 grid w-[270px] grid-cols-2 gap-3">
        <ShopButton />
        <RebirthButton />
      </div>
    </div>
  )
}
