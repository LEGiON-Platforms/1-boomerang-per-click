import { playSfx } from '../../audio/sfx'
import { ui, useUI } from '../../state/uiStore'
import { GearIcon } from '../icons'
import { useRewardAlerts } from './rewardAlerts'

/**
 * Top-right: just Settings. Daily rewards, gifts, quests, codes and friends open
 * from inside the Settings window; the "!" says something there can be claimed.
 */
export function HudTopRight() {
  const alerts = useRewardAlerts()
  const open = useUI((s) => s.panel === 'settings')
  return (
    <div className="hud-group hud-tr">
      <button
        type="button"
        className={`top-icon ${open ? 'active' : ''}`}
        aria-label="Settings"
        onClick={() => {
          playSfx('click')
          ui().togglePanel('settings')
        }}
      >
        <GearIcon size={54} />
        {alerts?.any && <span className="badge-alert txt-outline">!</span>}
      </button>
    </div>
  )
}
