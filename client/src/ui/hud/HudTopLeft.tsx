import { playSfx } from '../../audio/sfx'
import { stageLabel } from '../../net/connection'
import { useGame } from '../../state/gameStore'
import { ui } from '../../state/uiStore'
import { PlayersIcon, TargetIcon } from '../icons'

/** Top-left: Stages menu and room player list, plus where you are. */
export function HudTopLeft() {
  const here = useGame((s) => s.stageHere)
  const players = useGame((s) => s.roomPlayers.length)
  return (
    <div className="hud-group hud-tl flex items-start gap-2">
      <button
        type="button"
        className="top-icon"
        onClick={() => {
          playSfx('click')
          ui().togglePanel('stages')
        }}
      >
        <TargetIcon size={50} />
        <span className="caption txt-outline">Stages</span>
      </button>
      <button
        type="button"
        className="top-icon"
        onClick={() => {
          playSfx('click')
          ui().togglePanel('friends')
        }}
      >
        <PlayersIcon size={50} />
        <span className="caption txt-outline">{players}/8</span>
      </button>
      <span className="txt-outline ml-2 mt-5 text-[24px] opacity-90">{stageLabel(here)}</span>
    </div>
  )
}
