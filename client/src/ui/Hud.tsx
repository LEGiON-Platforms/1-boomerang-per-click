import { HudBottom, HudBottomLeft } from './hud/HudBottom'
import { HudLeft } from './hud/HudLeft'
import { HudOffers, HudTopRight } from './hud/HudRight'
import { HudTop } from './hud/HudTop'
import { PanelHost } from './PanelHost'
import { ConfirmDialog, Toasts } from './Toasts'

/** Everything drawn over the 3D view once the player is in the game. */
export function Hud() {
  return (
    <div className="hud">
      <HudTop />
      <HudLeft />
      <HudOffers />
      <HudTopRight />
      <HudBottom />
      <HudBottomLeft />
      <Toasts />
      <PanelHost />
      <ConfirmDialog />
    </div>
  )
}
