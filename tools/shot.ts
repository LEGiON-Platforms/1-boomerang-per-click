/**
 * Visual check: opens the game in headless Edge/Chrome, joins with a fresh guest,
 * runs a short script of inputs and saves screenshots to tools/out/.
 *
 *   npx tsx shot.ts [url] [--steps lobby|train|stage|all] [--mobile]
 */

import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium, type Page } from 'playwright-core'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, 'out')
mkdirSync(out, { recursive: true })

const args = process.argv.slice(2)
// Defaults to the isolated test client (port 5176 → test server 2568), never the dev room.
const url = args.find((a) => a.startsWith('http')) ?? 'http://localhost:5176/'
const stepsArg = args.includes('--steps') ? args[args.indexOf('--steps') + 1] : 'lobby'
const mobile = args.includes('--mobile')

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function shot(page: Page, name: string) {
  // Phone runs get an m- prefix so they never overwrite the desktop shots.
  const file = path.join(out, `${mobile && !name.startsWith('m-') ? 'm-' : ''}${name}.png`)
  await page.screenshot({ path: file })
  console.log('saved', file)
}

async function hold(page: Page, key: string, ms: number) {
  await page.keyboard.down(key)
  await sleep(ms)
  await page.keyboard.up(key)
}

async function clicks(page: Page, n: number, gap = 120) {
  for (let i = 0; i < n; i += 1) {
    await page.mouse.click(800, 420)
    await sleep(gap)
  }
}

const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'],
})
const context = await browser.newContext(
  mobile
    ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1600, height: 900 } },
)
const page = await context.newPage()
const errors: string[] = []
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') {
    const t = m.text()
    if (!t.includes('Download the React DevTools')) errors.push(`[${m.type()}] ${t}`)
  }
})
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))

/** Opens a menu window directly (dev hook), e.g. a Shop tab with no HUD button of its own. */
const openPanel = (p: string) =>
  page.evaluate((panel) => {
    ;(window as unknown as { __bpcUI: { getState(): { openPanel(p: string): void } } }).__bpcUI.getState().openPanel(panel)
  }, p)

await page.goto(url, { waitUntil: 'domcontentloaded' })
// No name screen: the game joins straight away.
await page.locator('.hud').waitFor({ timeout: 30000 })
await sleep(3500)
await shot(page, `${mobile ? 'm-' : ''}01-lobby`)

if (stepsArg === 'train' || stepsArg === 'all') {
  // Quick-train button 1 teleports to the free pad, then throw a few times.
  await page.locator('.train-tile').first().click()
  await sleep(800)
  await clicks(page, 14)
  await sleep(120)
  await shot(page, '02-training')
}

if (stepsArg === 'stage' || stepsArg === 'all') {
  await hold(page, 'w', 400)
  await page.evaluate(() => {
    ;(window as unknown as { __bpcTeleport?: (s: number) => void }).__bpcTeleport?.(1)
  })
  await sleep(1500)
  await shot(page, '03-stage')
  await clicks(page, 10)
  await hold(page, 'w', 1500)
  await clicks(page, 10)
  await sleep(500)
  await shot(page, '04-stage-walls')
}

if (stepsArg === 'clear' || stepsArg === 'all') {
  type G = { getState(): { run: { wallsBroken: number; stage: number } } }
  type Rt = { localPlayer: { pos: { x: number; z: number } } }
  const run = () => page.evaluate(() => (window as unknown as { __bpcGame: G }).__bpcGame.getState().run)
  const pos = () => page.evaluate(() => ({ ...(window as unknown as { __bpcRuntime: Rt }).__bpcRuntime.localPlayer.pos }))
  // Keep throwing and walking forward until every wall is down.
  for (let i = 0; i < 60 && (await run()).wallsBroken < 10; i += 1) {
    await clicks(page, 3, 110)
    await hold(page, 'w', 350)
  }
  const stage = (await run()).stage
  const padZ = -4 - 75 // one shared corridor: the pad is in the same place for every stage
  // Into the reward room, then look at it.
  await page.keyboard.down('Shift')
  for (let i = 0; i < 40 && (await pos()).z > padZ + 7; i += 1) await hold(page, 'w', 250)
  await page.keyboard.up('Shift')
  await sleep(500)
  await shot(page, '05-reward-room')
  // Onto the pad (left side, by the end wall).
  for (let i = 0; i < 40 && (await pos()).z > padZ + 1; i += 1) await hold(page, 'w', 150)
  for (let i = 0; i < 40 && (await pos()).x > -9; i += 1) await hold(page, 'a', 150)
  await sleep(450)
  await shot(page, '05-stage-clear')
  await sleep(2600)
  await shot(page, '05-respawn')
  // Walls stay down for 6 s in the lobby, then rise again (seen from high over the lobby).
  await page.evaluate('(() => { const c = window.__bpcRuntime.cameraState; c.yaw = 0; c.pitch = 0.5; c.distance = 38 })()')
  await sleep(800)
  console.log('walls down?', await page.evaluate('JSON.stringify(window.__bpcRuntime.wallHold)'))
  await shot(page, '05-lobby-walls-down')
  await sleep(2500)
  await shot(page, '05-lobby-walls-rising')
  await sleep(3500)
  console.log('walls rebuilt?', await page.evaluate('JSON.stringify(window.__bpcRuntime.wallHold)'))
  await shot(page, '05-lobby-walls-rebuilt')
}

if (stepsArg === 'panels' || stepsArg === 'all') {
  // Close anything open, then visit each menu in turn.
  await page.keyboard.press('Escape')
  if (await page.getByText('Farm Again ↻').isVisible().catch(() => false)) await page.getByText('Farm Again ↻').click()
  await sleep(400)
  for (const [label, file] of [
    ['Shop', '07-shop'],
    ['Rebirth', '08-rebirth'],
  ] as const) {
    await page.locator('button', { hasText: label }).first().click()
    await sleep(700)
    await shot(page, file)
    await page.keyboard.press('Escape')
    await sleep(300)
  }
  // The other Shop tabs and Settings.
  for (const [panel, file] of [
    ['trails', '06-trails'],
    ['stages', '09-stages'],
    ['boosts', '24-boosts'],
    ['settings', '25-settings'],
  ] as const) {
    await openPanel(panel)
    await sleep(700)
    await shot(page, file)
    await page.keyboard.press('Escape')
    await sleep(300)
  }
}

if (stepsArg === 'pets' || stepsArg === 'all') {
  await page.keyboard.press('Escape')
  await page.evaluate(() => {
    const send = (window as unknown as { __bpcSend: (t: string, p?: unknown) => void }).__bpcSend
    send('redeemCode', { code: 'RELEASE' })
    send('redeemCode', { code: '100LIKES' })
    setTimeout(() => send('buyGemItem', { item: 'starterPack' }), 600)
  })
  await sleep(2300)
  await shot(page, '10-egg-reveal')
  await sleep(2500)
  await page.mouse.click(800, 450)
  await sleep(800)
  await page.keyboard.press('Escape')
  await hold(page, 'd', 500)
  await sleep(600)
  await shot(page, '11-pet-follow')
  await openPanel('items')
  await sleep(700)
  await shot(page, '12-items')
  await page.keyboard.press('Escape')
}

if (stepsArg === 'retention' || stepsArg === 'all') {
  await page.keyboard.press('Escape')
  for (const [panel, file] of [
    ['daily', '13-daily'],
    ['gifts', '14-gifts'],
    ['quests', '15-quests'],
    ['friends', '16-friends'],
  ] as const) {
    await openPanel(panel)
    await sleep(600)
    await shot(page, file)
    await page.keyboard.press('Escape')
    await sleep(250)
  }
  await page.evaluate(() => {
    ;(window as unknown as { __bpcUI: { getState(): { set(p: object): void } } }).__bpcUI.getState().set({ tutorialRoll: 3 })
  })
  await sleep(4200)
  await shot(page, '17-tutorial-roll')
}

if (stepsArg === 'display') {
  // The Boomerang Stage seen from the lobby, then up close from its front tier.
  type Rt = { cameraState: { yaw: number; pitch: number; distance: number } }
  const camera = (yaw: number, pitch: number, distance: number) =>
    page.evaluate(
      ([y, p, d]) => {
        const c = (window as unknown as { __bpcRuntime: Rt }).__bpcRuntime.cameraState
        c.yaw = y
        c.pitch = p
        c.distance = d
      },
      [yaw, pitch, distance],
    )
  await page.keyboard.press('Escape')
  await page.keyboard.down('Shift')
  await hold(page, 'd', 1500)
  await page.keyboard.up('Shift')
  await camera(-Math.PI / 2 + 0.15, 0.2, 20)
  await sleep(900)
  await shot(page, '26-display')
  await camera(-Math.PI / 2, 0.15, 9)
  await page.keyboard.down('Shift')
  await hold(page, 'w', 1300)
  await page.keyboard.up('Shift')
  await sleep(700)
  await shot(page, '27-display-close')
}

if (stepsArg === 'line') {
  // Stage 1's walls, then straight on through its open gate into stage 2.
  type G = { getState(): { run: { wallsBroken: number; stage: number } } }
  type Rt = { localPlayer: { pos: { x: number; z: number } } }
  const run = () => page.evaluate(() => (window as unknown as { __bpcGame: G }).__bpcGame.getState().run)
  const pos = () => page.evaluate(() => ({ ...(window as unknown as { __bpcRuntime: Rt }).__bpcRuntime.localPlayer.pos }))
  await page.keyboard.press('Escape')
  for (let i = 0; i < 60 && (await run()).wallsBroken < 10; i += 1) {
    await clicks(page, 3, 110)
    await hold(page, 'w', 350)
  }
  await page.keyboard.down('Shift')
  for (let i = 0; i < 40 && (await pos()).z > -70; i += 1) await hold(page, 'w', 250)
  await page.keyboard.up('Shift')
  await sleep(500)
  await shot(page, '37-gate-open')
  await page.keyboard.down('Shift')
  for (let i = 0; i < 40 && (await pos()).z > -90; i += 1) await hold(page, 'w', 250)
  await page.keyboard.up('Shift')
  await sleep(800)
  console.log('after the gate:', JSON.stringify(await run()), JSON.stringify(await pos()))
  await shot(page, '38-stage-2')
}

if (stepsArg === 'shatter') {
  // Throw at stage 1's first wall until it breaks, then catch the chunks mid-flight.
  type G = { getState(): { run: { wallsBroken: number } } }
  const broken = () => page.evaluate(() => (window as unknown as { __bpcGame: G }).__bpcGame.getState().run.wallsBroken)
  await page.keyboard.press('Escape')
  await page.evaluate(() => {
    ;(window as unknown as { __bpcTeleport?: (s: number) => void }).__bpcTeleport?.(1)
  })
  await sleep(1200)
  await hold(page, 'w', 900)
  const start = await broken()
  for (let i = 0; i < 80 && (await broken()) === start; i += 1) await clicks(page, 1, 100)
  for (const [ms, name] of [[60, 'a'], [200, 'b'], [300, 'c'], [450, 'd'], [600, 'e']] as const) {
    await sleep(ms)
    await shot(page, `39-shatter-${name}`)
  }
}

if (stepsArg === 'prompt') {
  // Walk up to an egg so the "E" interact prompt shows.
  await page.keyboard.press('Escape')
  // Line up with the egg at x = 5, then walk south until its block stops us.
  await page.keyboard.down('Shift')
  await hold(page, 'd', 520)
  await hold(page, 's', 3600)
  await page.keyboard.up('Shift')
  await sleep(500)
  await shot(page, '34-prompt')
}

if (stepsArg === 'pose') {
  // The character from the front and the side: standing, frozen throw phases, a jump.
  type Rt = {
    cameraState: { yaw: number; pitch: number; distance: number }
    localPlayer: { rotY: number }
    devPose: { throwPhase: number | null }
  }
  const set = (yawOffset: number, phase: number | null) =>
    page.evaluate(
      ([off, ph]) => {
        const rt = (window as unknown as { __bpcRuntime: Rt }).__bpcRuntime
        rt.cameraState.yaw = rt.localPlayer.rotY + (off as number)
        rt.cameraState.pitch = 0.1
        rt.cameraState.distance = 6
        rt.devPose.throwPhase = ph as number | null
      },
      [yawOffset, phase],
    )
  await page.keyboard.press('Escape')
  // The bottom HUD would cover the legs.
  await page.addStyleTag({ content: '.hud-bc { display: none !important; }' })
  for (const [view, off] of [['front', 0], ['side', Math.PI / 2], ['back', Math.PI]] as const) {
    for (const phase of [null, 0.1, 0.2, 0.32, 0.45, 0.7]) {
      await set(off, phase)
      await sleep(350)
      await shot(page, `32-pose-${view}-${phase === null ? 'idle' : phase}`)
    }
  }
  await set(Math.PI / 2, null)
  await page.keyboard.press('Space')
  await sleep(180)
  await shot(page, '33-jump-up')
  await sleep(330)
  await shot(page, '33-jump-fall')
}

if (stepsArg === 'hold') {
  // Close-ups of the hold pose and a throw (wind-up / release timings are approximate).
  await page.keyboard.press('Escape')
  await page.evaluate(() => {
    const c = (window as unknown as { __bpcRuntime: { cameraState: { yaw: number; pitch: number; distance: number } } }).__bpcRuntime
      .cameraState
    c.yaw = 0.75
    c.pitch = 0.12
    c.distance = 5
  })
  await sleep(800)
  await shot(page, '28-hold')
  await page.mouse.click(800, 300)
  await sleep(70)
  await shot(page, '29-windup')
  await sleep(1200)
  await page.mouse.click(800, 300)
  await sleep(150)
  await shot(page, '30-release')
  await sleep(1200)
  await clicks(page, 6, 90)
  await shot(page, '31-flight')
}

if (stepsArg === 'refresh') {
  // Progress survives a refresh, and the old session's avatar doesn't linger.
  type G = { getState(): { power: number; xp: number; data: { wins: number } | null; roomPlayers: unknown[] } }
  const snap = () =>
    page.evaluate(() => {
      const g = (window as unknown as { __bpcGame: G }).__bpcGame.getState()
      return { power: Math.floor(g.power), xp: Math.floor(g.xp), wins: g.data?.wins ?? -1, players: g.roomPlayers.length }
    })
  await page.keyboard.press('Escape')
  await clicks(page, 15, 110)
  await sleep(1500)
  const before = await snap()
  console.log('before refresh:', JSON.stringify(before))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('.hud').waitFor({ timeout: 30000 })
  await sleep(2500)
  const after = await snap()
  console.log('after refresh: ', JSON.stringify(after))
  await shot(page, '47-after-refresh')
  console.log(after.power >= before.power && after.xp >= before.xp && after.wins >= before.wins ? 'progress kept' : 'PROGRESS LOST')
  console.log(after.players === before.players ? 'no leftover avatar' : `players before ${before.players}, after ${after.players}`)
}

if (stepsArg === 'banner') {
  // The win-pad "Stage Clear" banner (shown directly; the payout itself is untouched).
  await page.keyboard.press('Escape')
  await page.evaluate(() => {
    ;(window as unknown as { __bpcUI: { getState(): { set(p: object): void } } }).__bpcUI.getState().set({ stageClear: { stage: 7, wins: 1250 } })
  })
  await sleep(600)
  await shot(page, '45-stage-clear-banner')
}

if (stepsArg === 'walk') {
  // Walking in a curve, then stopping: the glowing path behind on the floor.
  await page.keyboard.press('Escape')
  await page.keyboard.down('w')
  await hold(page, 'd', 900)
  await hold(page, 'a', 900)
  await page.keyboard.up('w')
  await shot(page, '46-walk-path')
  await sleep(700)
  await shot(page, '46-walk-path-fading')
}

if (stepsArg === 'catch') {
  // One throw from the side: the hand empties as it flies, then reaches out to catch it.
  await page.keyboard.press('Escape')
  await page.addStyleTag({ content: '.hud-bc { display: none !important; }' })
  await page.evaluate(() => {
    const rt = (window as unknown as { __bpcRuntime: { cameraState: { yaw: number; pitch: number; distance: number }; localPlayer: { rotY: number } } })
      .__bpcRuntime
    rt.cameraState.yaw = rt.localPlayer.rotY - Math.PI / 2 + 0.3
    rt.cameraState.pitch = 0.15
    rt.cameraState.distance = 10
  })
  await sleep(800)
  await shot(page, '44-catch-0-idle')
  await page.mouse.click(800, 300)
  const t0 = Date.now()
  for (const [at, name] of [[60, '1-windup'], [300, '2-flying'], [560, '3-return'], [700, '4-catch'], [900, '5-caught']] as const) {
    await sleep(Math.max(0, at - (Date.now() - t0)))
    await shot(page, `44-catch-${name}`)
  }
}

if (stepsArg === 'boomerangs') {
  // Walk to the boomerang pedestals, face them, and cycle the display through the tiers
  // (owned count is overridden locally — display only, the server keeps the truth).
  await page.keyboard.press('Escape')
  await page.keyboard.down('Shift')
  await hold(page, 'd', 1500)
  await page.keyboard.up('Shift')
  await page.evaluate(() => {
    const rt = (window as unknown as { __bpcRuntime: { cameraState: { yaw: number; pitch: number; distance: number } } })
      .__bpcRuntime
    rt.cameraState.yaw = -Math.PI / 2 + 0.25
    rt.cameraState.pitch = 0.12
    rt.cameraState.distance = 7
  })
  const setOwned = (owned: number) =>
    page.evaluate((n) => {
      const g = (window as unknown as { __bpcGame: { getState(): { data: object; set(p: object): void } } }).__bpcGame
      g.getState().set({ data: { ...g.getState().data, boomerangsOwned: n } })
    }, owned)
  for (const owned of [1, 8, 15, 22, 25]) {
    await setOwned(owned)
    await sleep(900)
    await shot(page, `20-pedestals-${owned}`)
  }
  await clicks(page, 4, 90)
  await sleep(120)
  await shot(page, '21-throw')
  await page.locator('button', { hasText: 'Shop' }).first().click()
  await sleep(800)
  await shot(page, '22-shop-high')
  await setOwned(8)
  await page.keyboard.press('Escape')
  await sleep(300)
  await page.locator('button', { hasText: 'Shop' }).first().click()
  await sleep(800)
  await shot(page, '23-shop-low')
}

const info = await page.evaluate(() => window.__bpcRenderInfo?.() ?? null)
console.log('render info', JSON.stringify(info))
console.log(errors.length ? `console errors/warnings:\n${errors.slice(0, 30).join('\n')}` : 'no console errors')
await browser.close()
