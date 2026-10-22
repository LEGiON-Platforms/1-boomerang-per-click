/**
 * Floating feedback: click gains fly into the Power counter (flyGain), trophies
 * into the Wins counter (flyTrophies), and short messages float up (spawnMessage).
 *
 * Pooled floating "+X" popups. A fixed set of DOM nodes is created once and
 * recycled; each pop runs a Web Animation (no forced reflow to restart a CSS
 * animation, no permanent compositor layers), so rapid clicking never creates
 * or destroys elements.
 */

const POOL_SIZE = 16
let container: HTMLDivElement | null = null
const pool: HTMLDivElement[] = []
const running: (Animation | null)[] = []
let cursor = 0

const KEYFRAMES: Keyframe[] = [
  { opacity: 0, transform: 'translateY(10px) scale(0.6)', offset: 0 },
  { opacity: 1, transform: 'translateY(0) scale(1.06)', offset: 0.15 },
  { opacity: 1, transform: 'translateY(-14px) scale(1)', offset: 0.3 },
  { opacity: 0, transform: 'translateY(-110px) scale(0.9)', offset: 1 },
]
const TIMING: KeyframeAnimationOptions = { duration: 900, easing: 'ease-out', fill: 'forwards' }

export function mountFloatingLayer(parent: HTMLElement): () => void {
  container = document.createElement('div')
  container.className = 'float-layer'
  for (let i = 0; i < POOL_SIZE; i += 1) {
    const el = document.createElement('div')
    el.className = 'float-pop txt-outline'
    container.appendChild(el)
    pool.push(el)
    running.push(null)
  }
  parent.appendChild(container)
  return () => {
    container?.remove()
    container = null
    pool.length = 0
    running.length = 0
    trophies.length = 0
    gainNodes.length = 0
    gainAnims.length = 0
  }
}

/**
 * Shows `text` rising from (xPct, yPct) of the viewport. Back-to-back popups
 * alternate between two fixed rows instead of jittering randomly.
 */
export function spawnFloat(text: string, color = '#ffffff', xPct = 50, yPct = 74, big = false): void {
  if (!container || pool.length === 0) return
  const i = cursor
  cursor = (cursor + 1) % pool.length
  const el = pool[i]
  running[i]?.cancel()
  el.textContent = text
  el.style.color = color
  el.style.left = `${xPct}%`
  el.style.top = `${yPct - (i % 2) * 5}%`
  el.style.fontSize = big ? 'calc(56px * var(--hud-scale))' : 'calc(38px * var(--hud-scale))'
  running[i] = el.animate(KEYFRAMES, TIMING)
}

/* ---------------------------------------------------------------------------
 * Click gains flying into the Power counter
 * ------------------------------------------------------------------------- */

const FIRE_SRC =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<defs><linearGradient id="f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff3b1f"/>' +
      '<stop offset="0.6" stop-color="#ff9a1f"/><stop offset="1" stop-color="#ffe14a"/></linearGradient></defs>' +
      '<path d="M32 4c4 10 16 16 16 32a16 16 0 0 1-32 0c0-8 4-13 8-17 0 6 3 9 6 10-2-9 0-17 2-25z" fill="url(#f)" stroke="#1b1b22" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="M32 31c3 5 7 8 7 13a7 7 0 0 1-14 0c0-4 3-7 7-13z" fill="#fff3a0"/>' +
      '</svg>',
  )
const GAIN_POOL = 18
const gainNodes: HTMLDivElement[] = []
const gainAnims: (Animation | null)[] = []
let gainCursor = 0
let powerRect: DOMRect | null = null
let powerRectAt = 0
let powerBumpAt = 0

function gains(): HTMLDivElement[] {
  if (gainNodes.length || !container) return gainNodes
  for (let i = 0; i < GAIN_POOL; i += 1) {
    const el = document.createElement('div')
    el.className = 'fly-gain txt-outline'
    const img = document.createElement('img')
    img.src = FIRE_SRC
    img.alt = ''
    el.append(img, document.createElement('span'))
    container.appendChild(el)
    gainNodes.push(el)
    gainAnims.push(null)
  }
  return gainNodes
}

/** Centre of the Power counter (data-fly-target="power"); re-measured at most once a second. */
function powerTarget(): { x: number; y: number } | null {
  const t = performance.now()
  if (!powerRect || t - powerRectAt > 1000) {
    const el = document.querySelector<HTMLElement>('[data-fly-target="power"]')
    if (!el) return null
    powerRect = el.getBoundingClientRect()
    powerRectAt = t
  }
  return { x: powerRect.left + powerRect.width / 2, y: powerRect.top + powerRect.height / 2 }
}

/** One click's gain: "+X" with a flame flies from `from` (screen px) into the Power counter. */
export function flyGain(from: { x: number; y: number }, text: string, bump = true): void {
  if (!container) return
  const to = powerTarget()
  if (!to) return
  const nodes = gains()
  const i = gainCursor
  gainCursor = (gainCursor + 1) % nodes.length
  const el = nodes[i]
  ;(el.lastChild as HTMLSpanElement).textContent = text
  gainAnims[i]?.cancel()
  gainAnims[i] = el.animate(
    [
      { transform: `translate(${from.x}px, ${from.y}px) scale(0.6)`, opacity: 0 },
      { transform: `translate(${from.x}px, ${from.y - 46}px) scale(1.1)`, opacity: 1, offset: 0.22 },
      { transform: `translate(${to.x}px, ${to.y}px) scale(0.75)`, opacity: 1, offset: 0.9 },
      { transform: `translate(${to.x}px, ${to.y}px) scale(0.4)`, opacity: 0 },
    ],
    { duration: 720, easing: 'ease-in', fill: 'forwards' },
  )
  // The counter gives a little bump as gains land (throttled for fast clicking).
  const t = performance.now()
  if (bump && t - powerBumpAt > 140) {
    powerBumpAt = t
    document
      .querySelector<HTMLElement>('[data-fly-target="power"]')
      ?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 160, delay: 600 })
  }
}

/* ---------------------------------------------------------------------------
 * Trophies flying to the Wins counter (win pad payout)
 * ------------------------------------------------------------------------- */

const TROPHY_SRC =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<path d="M14 8h36v10c0 13-8 22-18 22S14 31 14 18z" fill="#ffc61a" stroke="#1b1b22" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="M14 14H6c0 9 4 14 10 15M50 14h8c0 9-4 14-10 15" fill="none" stroke="#1b1b22" stroke-width="4"/>' +
      '<rect x="27" y="39" width="10" height="10" fill="#e8a400" stroke="#1b1b22" stroke-width="4"/>' +
      '<rect x="17" y="48" width="30" height="9" rx="2" fill="#ffc61a" stroke="#1b1b22" stroke-width="4"/>' +
      '<path d="M22 13v6c0 6 3 11 7 13" fill="none" stroke="#fff3b0" stroke-width="4" stroke-linecap="round"/>' +
      '</svg>',
  )
const TROPHY_POOL = 14
const trophies: HTMLImageElement[] = []

function trophyNodes(): HTMLImageElement[] {
  if (trophies.length || !container) return trophies
  for (let i = 0; i < TROPHY_POOL; i += 1) {
    const img = document.createElement('img')
    img.src = TROPHY_SRC
    img.alt = ''
    img.className = 'fly-trophy'
    container.appendChild(img)
    trophies.push(img)
  }
  return trophies
}

/**
 * A burst of trophies from screen point (x, y) that flies into the Wins counter
 * (the element marked data-fly-target="wins"), which pops as they land.
 */
export function flyTrophies(x: number, y: number, count = 12): void {
  const target = document.querySelector<HTMLElement>('[data-fly-target="wins"]')
  if (!container || !target) return
  const r = target.getBoundingClientRect()
  const tx = r.left + r.width / 2
  const ty = r.top + r.height / 2
  const nodes = trophyNodes()
  const n = Math.min(count, nodes.length)
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2
    const bx = x + Math.cos(a) * 90
    const by = y + Math.sin(a) * 60 - 40
    nodes[i].getAnimations().forEach((anim) => anim.cancel())
    nodes[i].animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(0.3)`, opacity: 0 },
        { transform: `translate(${bx}px, ${by}px) scale(1.15)`, opacity: 1, offset: 0.25 },
        { transform: `translate(${bx}px, ${by}px) scale(1)`, opacity: 1, offset: 0.38 },
        { transform: `translate(${tx}px, ${ty}px) scale(0.65)`, opacity: 1, offset: 0.94 },
        { transform: `translate(${tx}px, ${ty}px) scale(0.4)`, opacity: 0 },
      ],
      { duration: 1150, delay: i * 50, easing: 'ease-in-out', fill: 'both' },
    )
  }
  target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], {
    duration: 300,
    delay: 1050,
    iterations: Math.max(1, Math.ceil(n / 4)),
  })
}

/* ---------------------------------------------------------------------------
 * Feedback messages ("Need 5 more Wins", "Copper Boomerang unlocked!")
 * ------------------------------------------------------------------------- */

const MESSAGE_KEYFRAMES: Keyframe[] = [
  { opacity: 0, transform: 'translateY(12px) scale(0.9)', offset: 0 },
  { opacity: 1, transform: 'translateY(0) scale(1)', offset: 0.1 },
  { opacity: 1, transform: 'translateY(-10px) scale(1)', offset: 0.75 },
  { opacity: 0, transform: 'translateY(-40px) scale(1)', offset: 1 },
]
const MESSAGE_TIMING: KeyframeAnimationOptions = { duration: 1900, easing: 'ease-out', fill: 'forwards' }
let lastMessage = ''
let lastMessageAt = 0
let messageRow = 0

/** One short line floating up over the player; repeats within a second are skipped. */
export function spawnMessage(text: string, color: string): void {
  if (!container || pool.length === 0) return
  const t = performance.now()
  if (text === lastMessage && t - lastMessageAt < 1000) return
  lastMessage = text
  lastMessageAt = t
  const i = cursor
  cursor = (cursor + 1) % pool.length
  const el = pool[i]
  running[i]?.cancel()
  el.textContent = text
  el.style.color = color
  el.style.left = '50%'
  // Back-to-back messages take alternate rows so they don't overlap.
  messageRow = (messageRow + 1) % 2
  el.style.top = `${34 - messageRow * 6}%`
  el.style.fontSize = 'calc(32px * var(--hud-scale))'
  running[i] = el.animate(MESSAGE_KEYFRAMES, MESSAGE_TIMING)
}
