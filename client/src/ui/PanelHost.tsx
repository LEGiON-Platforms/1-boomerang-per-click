import { type ComponentType, lazy, type LazyExoticComponent, Suspense } from 'react'

import { type PanelId, useUI } from '../state/uiStore'

// One window for every Shop tab: the same component, so switching tabs never remounts it.
const shopWindow = lazy(() => import('./panels/ShopWindow').then((m) => ({ default: m.ShopWindow })))

/**
 * Menu windows load on first open (React.lazy) — none of them is needed to
 * start playing, so they stay out of the startup bundle.
 */
const panels: Record<PanelId, LazyExoticComponent<ComponentType>> = {
  settings: lazy(() => import('./panels/SettingsPanel').then((m) => ({ default: m.SettingsPanel }))),
  stages: lazy(() => import('./panels/StagesPanel').then((m) => ({ default: m.StagesPanel }))),
  shop: shopWindow,
  trails: shopWindow,
  items: shopWindow,
  boosts: shopWindow,
  rebirth: lazy(() => import('./panels/RebirthPanel').then((m) => ({ default: m.RebirthPanel }))),
  egg: lazy(() => import('./panels/EggPanel').then((m) => ({ default: m.EggPanel }))),
  gifts: lazy(() => import('./panels/GiftsPanel').then((m) => ({ default: m.GiftsPanel }))),
  daily: lazy(() => import('./panels/DailyPanel').then((m) => ({ default: m.DailyPanel }))),
  quests: lazy(() => import('./panels/QuestsPanel').then((m) => ({ default: m.QuestsPanel }))),
  codes: lazy(() => import('./panels/CodesPanel').then((m) => ({ default: m.CodesPanel }))),
  friends: lazy(() => import('./panels/FriendsPanel').then((m) => ({ default: m.FriendsPanel }))),
}

/** Renders whichever menu window is open. */
export function PanelHost() {
  const panel = useUI((s) => s.panel)
  if (!panel) return null
  const Panel = panels[panel]
  return (
    <Suspense fallback={null}>
      <Panel />
    </Suspense>
  )
}

/** Warm the panel chunks once the game is idle, so first opens are instant. */
export function prefetchPanels(): void {
  const load = () => {
    void import('./panels/ShopWindow')
    void import('./panels/RebirthPanel')
    void import('./panels/StagesPanel')
  }
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
  if (w.requestIdleCallback) w.requestIdleCallback(load, { timeout: 8000 })
  else window.setTimeout(load, 4000)
}
