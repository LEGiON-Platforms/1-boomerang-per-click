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
const url = args.find((a) => a.startsWith('http')) ?? 'http://localhost:5174/'
const stepsArg = args.includes('--steps') ? args[args.indexOf('--steps') + 1] : 'lobby'
const mobile = args.includes('--mobile')

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function shot(page: Page, name: string) {
  const file = path.join(out, `${name}.png`)
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

await page.goto(url, { waitUntil: 'domcontentloaded' })
const nameInput = page.locator('input').first()
await nameInput.waitFor({ timeout: 20000 })
await nameInput.fill(`Shot${Math.floor(Math.random() * 9000 + 1000)}`)
await page.getByText('PLAY', { exact: true }).click()
await page.locator('.hud').waitFor({ timeout: 30000 })
await sleep(3500)
await shot(page, `${mobile ? 'm-' : ''}01-lobby`)

if (stepsArg === 'train' || stepsArg === 'all') {
  // Quick-train button 1 teleports to the free pad, then throw a few times.
  await page.locator('.quick-train').first().click()
  await sleep(800)
  await clicks(page, 14)
  await sleep(300)
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
  // Keep throwing and walking until the tutorial says the walls are down.
  for (let i = 0; i < 40; i += 1) {
    if (await page.getByText('Collect your Wins!').isVisible().catch(() => false)) break
    await clicks(page, 3, 110)
    await hold(page, 'w', 350)
  }
  await page.keyboard.down('Shift')
  await hold(page, 'w', 9000)
  await page.keyboard.up('Shift')
  await sleep(1200)
  await shot(page, '05-stage-clear')
}

if (stepsArg === 'panels' || stepsArg === 'all') {
  // Close anything open, then visit each menu in turn.
  await page.keyboard.press('Escape')
  if (await page.getByText('Farm Again ↻').isVisible().catch(() => false)) await page.getByText('Farm Again ↻').click()
  await sleep(400)
  for (const [label, file] of [
    ['Trails', '06-trails'],
    ['Shop', '07-shop'],
    ['Rebirth', '08-rebirth'],
    ['Stages', '09-stages'],
  ] as const) {
    await page.locator('button', { hasText: label }).first().click()
    await sleep(700)
    await shot(page, file)
    await page.keyboard.press('Escape')
    await sleep(300)
  }
}

const info = await page.evaluate(() => window.__bpcRenderInfo?.() ?? null)
console.log('render info', JSON.stringify(info))
console.log(errors.length ? `console errors/warnings:\n${errors.slice(0, 30).join('\n')}` : 'no console errors')
await browser.close()
