import {
  autoThrowUnlocked,
  BOOSTS,
  type BoostId,
  C2S,
  clickGainFor,
  EGGS,
  formatGain,
  formatNumber,
  formatTimer,
  friendBoostFraction,
  isPadUnlocked,
  levelForXp,
  levelProgress,
  TRAINING_PADS,
} from '@game/shared'

import { playSfx } from '../../audio/sfx'
import { interact } from '../../game/interact'
import { send } from '../../net/connection'
import { isTouchDevice } from '../../state/qualityStore'
import { useGame, type InteractTarget } from '../../state/gameStore'
import { ui } from '../../state/uiStore'
import { useServerClock } from '../hooks'
import { FriendsIcon, HandIcon, LockIcon, PowerBurstIcon, RebirthIcon } from '../icons'

const QUICK_COLORS = ['bg-green', 'bg-blue', 'bg-yellow', 'bg-red']

function useFriendsInRoom(): number {
  const friends = useGame((s) => s.data?.friends)
  const players = useGame((s) => s.roomPlayers)
  if (!friends?.length) return 0
  return players.filter((p) => !p.isLocal && friends.includes(p.pid)).length
}

/** Four quick-train buttons: the best unlocked pads (+ next locked), teleport on tap. */
function QuickTrain() {
  const data = useGame((s) => s.data)
  const friends = useFriendsInRoom()
  const now = useServerClock(5000)
  if (!data) return null
  const best = TRAINING_PADS.reduce((b, p) => (data.rebirths >= p.requiredRebirths ? p.id : b), 0)
  const end = Math.min(TRAINING_PADS.length - 1, Math.max(3, best + (best < TRAINING_PADS.length - 1 ? 1 : 0)))
  const pads = TRAINING_PADS.slice(end - 3, end + 1)
  return (
    <div className="mt-6 flex gap-5">
      {pads.map((pad, i) => {
        const unlocked = isPadUnlocked(pad.id, data.rebirths)
        const gain = clickGainFor(data, { padId: pad.id, friendsInRoom: friends, now })
        return (
          <button
            key={pad.id}
            type="button"
            className={`btn3d studs quick-train ${QUICK_COLORS[i]}`}
            onClick={() => {
              playSfx('click')
              if (unlocked) send(C2S.teleportPad, { pad: pad.id })
              else ui().toast(`Unlocks at Rebirth ${pad.requiredRebirths}`, 'error')
            }}
          >
            <span className="txt-outline">{unlocked ? `+${formatGain(gain)}` : <LockIcon size={40} />}</span>
            <span className="tag txt-outline" style={{ color: unlocked ? '#7dff6b' : '#ff6b6b' }}>
              {pad.requiredRebirths > 0 && <RebirthIcon size={22} />}
              {unlocked ? `x${pad.mult}` : pad.requiredRebirths}
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
  const label = promptLabel(target)
  return (
    <button type="button" className="interact-prompt txt-outline mb-3" onClick={interact}>
      {!isTouchDevice() && <span className="key-cap">E</span>}
      {label}
    </button>
  )
}

function promptLabel(t: InteractTarget): string {
  switch (t.kind) {
    case 'trails':
      return 'Open Trails'
    case 'rebirth':
      return 'Rebirth'
    case 'stages':
      return 'Choose a Stage'
    case 'egg':
      return `Open ${EGGS[t.index]?.name ?? 'Egg'}`
    case 'pedestal':
      return 'Buy Boomerang'
  }
}

export function HudBottom() {
  const power = useGame((s) => s.power)
  const xp = useGame((s) => s.xp)
  const level = levelForXp(xp)
  return (
    <div className="hud-group hud-bc flex flex-col items-center">
      <InteractPrompt />
      <div className="power-badge">
        <PowerBurstIcon className="burst" />
        <span className="value txt-outline">{formatNumber(power)} Power</span>
      </div>
      <div className="level-bar">
        <div className="fill" style={{ width: `${levelProgress(xp) * 100}%` }} />
        <span className="text txt-outline">LEVEL {level}</span>
      </div>
      <QuickTrain />
    </div>
  )
}

const BOOST_ORDER: BoostId[] = ['click3x', 'power2x', 'wins2x', 'training2x']

/** Bottom-left: active boost timers, friend boost, auto-throw toggle. */
export function HudBottomLeft() {
  const data = useGame((s) => s.data)
  const autoThrow = useGame((s) => s.autoThrow)
  const friends = useFriendsInRoom()
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
      <button type="button" className="boost-row txt-outline" onClick={() => ui().openPanel('friends')}>
        <FriendsIcon size={40} />
        <span>Friend Boost:</span>
        <span style={{ color: '#ffd21f' }}>{Math.round(friendBoostFraction(friends) * 100)}%</span>
        <span className="text-[34px]" style={{ color: '#2ee66b' }}>
          +
        </span>
      </button>
    </div>
  )
}
