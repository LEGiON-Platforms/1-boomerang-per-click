import { useUI } from '../state/uiStore'
import { RebirthPanel } from './panels/RebirthPanel'
import { SettingsPanel } from './panels/SettingsPanel'
import { ShopPanel } from './panels/ShopPanel'
import { StagesPanel } from './panels/StagesPanel'
import { TrailsPanel } from './panels/TrailsPanel'

/** Renders whichever menu window is open. */
export function PanelHost() {
  const panel = useUI((s) => s.panel)
  switch (panel) {
    case 'settings':
      return <SettingsPanel />
    case 'stages':
      return <StagesPanel />
    case 'trails':
      return <TrailsPanel />
    case 'shop':
      return <ShopPanel />
    case 'rebirth':
      return <RebirthPanel />
    default:
      return null
  }
}
