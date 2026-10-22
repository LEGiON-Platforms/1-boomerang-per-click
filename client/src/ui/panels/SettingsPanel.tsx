import { useGame } from '../../state/gameStore'
import { type Preset, useQuality } from '../../state/qualityStore'
import { type PanelId, ui } from '../../state/uiStore'
import { useRewardAlerts } from '../hud/rewardAlerts'
import { CalendarIcon, CodeIcon, FriendsIcon, GiftIcon, TargetIcon, TimerIcon } from '../icons'
import { Window } from '../Window'

function RewardButton({ panel, label, icon, alert, caption }: { panel: PanelId; label: string; icon: React.ReactNode; alert?: boolean; caption?: string }) {
  return (
    <button type="button" className="btn3d reward-btn bg-dark" onClick={() => ui().openPanel(panel)}>
      {icon}
      <span className="txt-outline text-[20px]">{label}</span>
      {caption && (
        <span className="txt-outline text-[16px]" style={{ color: alert ? '#ffe14a' : '#c9cfdd' }}>
          {caption}
        </span>
      )}
      {alert && <span className="badge-alert txt-outline">!</span>}
    </button>
  )
}

/** Daily rewards, playtime gifts, quests, codes, friends and stages — they live here, not on the HUD. */
function RewardsRow() {
  const a = useRewardAlerts()
  if (!a) return null
  return (
    <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
      <RewardButton panel="daily" label="Daily" icon={<CalendarIcon size={50} day={a.dailyDay} />} alert={a.daily} caption={a.daily ? 'CLAIM!' : undefined} />
      <RewardButton panel="gifts" label="Gifts" icon={<TimerIcon size={50} />} alert={a.gift} caption={a.giftCaption} />
      <RewardButton panel="quests" label="Quests" icon={<GiftIcon size={50} />} alert={a.quest} />
      <RewardButton panel="codes" label="Codes" icon={<CodeIcon size={50} />} />
      <RewardButton panel="friends" label="Friends" icon={<FriendsIcon size={50} />} />
      <RewardButton panel="stages" label="Stages" icon={<TargetIcon size={50} />} />
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="list-row justify-between">
      <span className="txt-outline text-[26px]">{label}</span>
      <button type="button" className={`btn3d buy-btn ${value ? 'bg-green' : 'bg-dark'}`} onClick={() => onChange(!value)}>
        <span className="txt-outline">{value ? 'ON' : 'OFF'}</span>
      </button>
    </div>
  )
}

export function SettingsPanel() {
  const q = useQuality()
  const roomId = useGame((s) => s.roomId)
  const presets: (Preset | 'AUTO')[] = ['AUTO', 'LOW', 'MEDIUM', 'HIGH']
  const current = q.auto ? 'AUTO' : q.preset

  return (
    <Window title="Settings" onClose={() => ui().closePanel()} width={760}>
      <RewardsRow />
      <div className="list-row flex-wrap justify-between gap-3">
        <span className="txt-outline text-[26px]">Graphics</span>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              className={`btn3d tab-btn ${current === p ? 'bg-cyan' : 'bg-dark'}`}
              onClick={() => (p === 'AUTO' ? q.setAuto() : q.setPreset(p))}
            >
              <span className="txt-outline">{p === 'AUTO' ? `Auto (${q.preset})` : p}</span>
            </button>
          ))}
        </div>
      </div>
      <Toggle label="Music" value={q.music} onChange={q.setMusic} />
      <Toggle label="Sound Effects" value={q.sfx} onChange={q.setSfx} />
      <Toggle label="Hide other players' pets" value={q.hideOtherPets} onChange={q.setHideOtherPets} />
      {import.meta.env.DEV && <Toggle label="Performance overlay (dev)" value={q.showPerf} onChange={q.setShowPerf} />}

      <div className="body-text mt-2 text-[15px] opacity-80">
        Controls: WASD / arrows to move · Shift sprint · Space jump · Click or F to throw · E to interact · Right-drag to turn the
        camera · Scroll to zoom. On phones: left stick to move, tap anywhere to throw, drag to look.
        <br />
        Room: {roomId}
      </div>
    </Window>
  )
}
