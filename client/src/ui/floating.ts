/**
 * Pooled floating "+X" popups. A fixed set of DOM nodes is created once and
 * recycled; each pop is a CSS animation restart, so rapid clicking never creates
 * or destroys elements.
 */

const POOL_SIZE = 24
let container: HTMLDivElement | null = null
const pool: HTMLDivElement[] = []
let cursor = 0

export function mountFloatingLayer(parent: HTMLElement): () => void {
  container = document.createElement('div')
  container.className = 'float-layer'
  for (let i = 0; i < POOL_SIZE; i += 1) {
    const el = document.createElement('div')
    el.className = 'float-pop txt-outline'
    container.appendChild(el)
    pool.push(el)
  }
  parent.appendChild(container)
  return () => {
    container?.remove()
    container = null
    pool.length = 0
  }
}

/**
 * Shows `text` rising from (xPct, yPct) of the viewport, jittered so a burst of
 * clicks fans out instead of stacking.
 */
export function spawnFloat(text: string, color = '#ffffff', xPct = 50, yPct = 74, big = false): void {
  if (!container || pool.length === 0) return
  const el = pool[cursor]
  cursor = (cursor + 1) % pool.length
  el.textContent = text
  el.style.color = color
  el.style.left = `${xPct + (Math.random() - 0.5) * 14}%`
  el.style.top = `${yPct + (Math.random() - 0.5) * 6}%`
  el.style.fontSize = big ? 'calc(56px * var(--hud-scale))' : 'calc(38px * var(--hud-scale))'
  // Restart the animation: drop the class, force a reflow, add it back.
  el.classList.remove('float-go')
  void el.offsetWidth
  el.classList.add('float-go')
}
