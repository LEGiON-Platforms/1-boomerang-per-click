import { useUI } from '../state/uiStore'
import { SettingsPanel } from './panels/SettingsPanel'

/** Renders whichever menu window is open. */
export function PanelHost() {
  const panel = useUI((s) => s.panel)
  switch (panel) {
    case 'settings':
      return <SettingsPanel />
    default:
      return null
  }
}
