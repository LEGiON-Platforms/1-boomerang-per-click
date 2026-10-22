import { useUI } from '../state/uiStore'
import { CodesPanel } from './panels/CodesPanel'
import { DailyPanel } from './panels/DailyPanel'
import { EggPanel } from './panels/EggPanel'
import { FriendsPanel } from './panels/FriendsPanel'
import { GiftsPanel } from './panels/GiftsPanel'
import { ItemsPanel } from './panels/ItemsPanel'
import { QuestsPanel } from './panels/QuestsPanel'
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
    case 'egg':
      return <EggPanel />
    case 'items':
      return <ItemsPanel />
    case 'gifts':
      return <GiftsPanel />
    case 'daily':
      return <DailyPanel />
    case 'quests':
      return <QuestsPanel />
    case 'codes':
      return <CodesPanel />
    case 'friends':
      return <FriendsPanel />
    default:
      return null
  }
}
