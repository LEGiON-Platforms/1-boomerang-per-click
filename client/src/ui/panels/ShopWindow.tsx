import { TUTORIAL_STEPS } from '@game/shared'

import { useGame } from '../../state/gameStore'
import { isShopTab, type ShopTab, ui, useUI } from '../../state/uiStore'
import { Tabs, Window } from '../Window'
import { BoomerangsTab } from './BoomerangsTab'
import { BoostsTab } from './BoostsTab'
import { ItemsTab } from './ItemsTab'
import { TrailsTab, TrailsTutorialFooter } from './TrailsTab'

const TABS: { id: ShopTab; label: string }[] = [
  { id: 'shop', label: 'Boomerangs' },
  { id: 'trails', label: 'Trails' },
  { id: 'items', label: 'Items' },
  { id: 'boosts', label: 'Boosts' },
]

/**
 * The Shop window. Each tab is its own panel id, so the lobby stalls and the
 * tutorial can open straight onto Trails, and switching tabs keeps the window.
 */
export function ShopWindow() {
  const panel = useUI((s) => s.panel)
  const buyTrail = useGame((s) => s.data?.tutorialStep === TUTORIAL_STEPS.buyTrail)
  const tab: ShopTab = isShopTab(panel) ? panel : 'shop'
  return (
    <Window
      title="Shop"
      width={960}
      onClose={() => ui().closePanel()}
      tabs={<Tabs value={tab} options={TABS} onChange={(id) => ui().openPanel(id)} />}
      footer={tab === 'trails' && buyTrail ? <TrailsTutorialFooter /> : undefined}
    >
      {tab === 'shop' && <BoomerangsTab />}
      {tab === 'trails' && <TrailsTab />}
      {tab === 'items' && <ItemsTab />}
      {tab === 'boosts' && <BoostsTab />}
    </Window>
  )
}
