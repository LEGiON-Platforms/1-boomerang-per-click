import {
  autoThrowUnlocked,
  BOOMERANGS,
  BOOSTS,
  type BoostId,
  C2S,
  clickGainFor,
  EGGS,
  formatGain,
  formatNumber,
  formatTimer,
  isPadUnlocked,
  levelForXp,
  levelProgress,
  TRAINING_PADS,
} from '@game/shared'

import { playSfx } from '../../audio/sfx'
import { interact } from '../../game/interact'
import { displayStart } from '../../game/lobby/boomerangDisplay'
import { send } from '../../net/connection'
import { isTouchDevice } from '../../state/qualityStore'
import { useGame, type InteractTarget } from '../../state/gameStore'
import { ui } from '../../state/uiStore'
import { useGameThrottled, useServerClock } from '../hooks'
import { HandIcon, PowerBurstIcon } from '../icons'
import { Num } from '../Num'

const QUICK_COLORS = ['bg-green', 'bg-blue', 'bg-yellow', 'bg-red']

function useFriendsInRoom(): number {
  const friends = useGame((s) => s.data?.friends)
  const players = useGame((s) => s.roomPlayers)
  if (!friends?.length) return 0
  return players.filter((p) => !p.isLocal && friends.includes(p.pid)).length
}

/** Four training buttons: the best unlocked pads (+ the next locked one); tap to teleport. */
function QuickTrain() {
  const data = useGame((s) => s.data)
  const onPad = useGame((s) => s.onPad)
  const friends = useFriendsInRoom()
  const now = useServerClock(5000)
  if (!data) return null
  const best = TRAINING_PADS.reduce((b, p) => (data.rebirths >= p.requiredRebirths ? p.id : b), 0)
  const end = Math.min(TRAINING_PADS.length - 1, Math.max(3, best + (best < TRAINING_PADS.length - 1 ? 1 : 0)))
  const pads = TRAINING_PADS.slice(end - 3, end + 1)
  return (
    <div className="train-row">
      {pads.map((pad, i) => {
        const unlocked = isPadUnlocked(pad.id, data.rebirths)
        // Locked pads still show what they would give, so there is something to aim for.
        const gain = unlocked
          ? clickGainFor(data, { padId: pad.id, friendsInRoom: friends, now })
          : clickGainFor(data, { padId: -1, friendsInRoom: friends, now }) * pad.mult
        return (
          <button
            key={pad.id}
            type="button"
            className={`btn3d studs train-tile ${QUICK_COLORS[i]} ${onPad === pad.id ? 'active' : ''}`}
            onClick={() => {
              playSfx('click')
              if (unlocked) send(C2S.teleportPad, { pad: pad.id })
              else ui().toast(`Unlocks at Rebirth ${pad.requiredRebirths}`, 'error')
            }}
          >
            <Num value={`+${formatGain(gain)}`} className="gain txt-outline" />
            {/* Rebirths needed, as a green token like the original (pad 1 shows its multiplier). */}
            <span className="tag txt-outline">
              {pad.requiredRebirths > 0 && <span className="rb-token" />}
              <Num value={pad.requiredRebirths > 0 ? String(pad.requiredRebirths) : `x${pad.mult}`} />
            </span>
          </button>
        )
      })}
    </div>
  )
}

function InteractPrompt() {
  const target = useGame((s) => s.nearInteract)
  const data = useGame((s) => s.data)
  if (!target || !data) return null
  const label = promptLabel(target, data.boomerangsOwned)
  return (
    <button type="button" className="interact-prompt txt-outline mb-3" onClick={interact}>
      {!isTouchDevice() && <span className="key-cap">E</span>}
      {label}
    </button>
  )
}

function promptLabel(t: InteractTarget, owned: number): string {
  switch (t.kind) {
    case 'trails':
      return 'Open Trails'
    case 'rebirth':
      return 'Rebirth'
    case 'egg':
      return `Open ${EGGS[t.index]?.name ?? 'Egg'}`
    case 'pedestal': {
      const b = BOOMERANGS[displayStart(owned) + t.index]
      if (!b) return 'Boomerang Shop'
      if (b.id === owned) return `Buy ${b.name} · ${formatNumber(b.cost)} Wins`
      return b.id < owned ? `${b.name} (Owned)` : 'Boomerang Shop'
    }
  }
}

/** Leaf components own the per-throw subscriptions, so a throw re-renders only them. */
const selectPower = (s: { power: number }) => Math.floor(s.power)
const selectLevelPct = (s: { xp: number }) => Math.floor(levelProgress(s.xp) * 200) / 2
const selectLevel = (s: { xp: number }) => levelForXp(s.xp)

function PowerBadge() {
  const power = useGameThrottled(selectPower)
  return (
    <div className="power-badge" data-fly-target="power">
      <PowerBurstIcon size={124} className="burst" />
      <Num value={`${formatNumber(power)} Power`} className="value txt-outline" />
    </div>
  )
}

function LevelBar() {
  // Quantised and throttled so tiny XP gains don't re-render the bar.
  const pct = useGameThrottled(selectLevelPct)
  const level = useGameThrottled(selectLevel)
  return (
    <div className="level-bar">
      {/* Slid by transform, not width: no layout or repaint as XP ticks up. */}
      <div className="fill" style={{ transform: `translateX(${pct - 100}%)` }} />
      <Num value={`LEVEL ${level}`} className="text txt-outline" />
    </div>
  )
}

export function HudBottom() {
  return (
    <div className="hud-group hud-bc flex flex-col items-center">
      <InteractPrompt />
      <PowerBadge />
      <LevelBar />
      <QuickTrain />
    </div>
  )
}

const BOOST_ORDER: BoostId[] = ['click3x', 'power2x', 'wins2x', 'training2x']

/** Bottom-left: the auto-throw switch and active boost timers. */
export function HudBottomLeft() {
  const data = useGame((s) => s.data)
  const autoThrow = useGame((s) => s.autoThrow)
  const now = useServerClock(1000)
  if (!data) return null
  const active = BOOST_ORDER.filter((id) => (data.boosts[id] ?? 0) > now)
  return (
    <div className="hud-group hud-bl flex flex-col gap-3">
      {autoThrowUnlocked(data) && (
        <button
          type="button"
          className={`btn3d studs self-start px-4 py-2 ${autoThrow ? 'bg-green' : 'bg-dark'}`}
          onClick={() => {
            playSfx('click')
            useGame.getState().set({ autoThrow: !autoThrow })
          }}
        >
          <span className="txt-outline text-[24px]">Auto Throw: {autoThrow ? 'ON' : 'OFF'}</span>
        </button>
      )}
      {active.map((id) => (
        <div key={id} className="boost-row txt-outline">
          <HandIcon size={30} />
          <span style={{ color: BOOSTS[id].color }}>{BOOSTS[id].name}:</span>
          <span>{formatTimer(((data.boosts[id] ?? 0) - now) / 1000)}</span>
        </div>
      ))}
    </div>
  )
}
