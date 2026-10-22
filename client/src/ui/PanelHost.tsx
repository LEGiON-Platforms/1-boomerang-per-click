import { useUI } from '../state/uiStore'
import { SettingsPanel } from './panels/SettingsPanel'
import { StagesPanel } from './panels/StagesPanel'

/** Renders whichever menu window is open. */
export function PanelHost() {
  const panel = useUI((s) => s.panel)
  switch (panel) {
    case 'settings':
      return <SettingsPanel />
    case 'stages':
      return <StagesPanel />
    default:
      return null
  }
}
