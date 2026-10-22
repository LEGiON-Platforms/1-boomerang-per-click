import { HudBottom, HudBottomLeft } from './hud/HudBottom'
import { HudLeft } from './hud/HudLeft'
import { HudTopRight } from './hud/HudRight'
import { TutorialDriver } from './hud/TutorialDriver'
import { EggReveal } from './overlays/EggReveal'
import { OfflinePopup, RewardPopup, TutorialRoll } from './overlays/Popups'
import { StageClear } from './overlays/StageClear'
import { PanelHost } from './PanelHost'
import { ConfirmDialog } from './ConfirmDialog'

/**
 * Everything drawn over the 3D view once the player is in the game. The top-left
 * corner is deliberately empty: hosts put their game logo there.
 */
export function Hud() {
  return (
    <div className="hud">
      <TutorialDriver />
      <HudLeft />
      <HudTopRight />
      <HudBottom />
      <HudBottomLeft />
      <StageClear />
      <PanelHost />
      <RewardPopup />
      <OfflinePopup />
      <TutorialRoll />
      <EggReveal />
      <ConfirmDialog />
    </div>
  )
}
