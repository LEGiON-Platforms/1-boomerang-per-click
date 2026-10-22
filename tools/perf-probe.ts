/**
 * Performance probe: measures the production build in a real browser.
 *
 *   npm run build -w client && npx vite preview --port 4173 (in client/)
 *   npm run dev -w server
 *   npm run perf                      # → tools/out/perf-report.md
 *
 * Scenarios: desktop HIGH, desktop MEDIUM, mobile LOW (844×390, touch, 4× CPU
 * throttle). Seven bot players (with pets) share the room, so remote avatars,
 * pets and projectiles are on screen — the 8-player worst case. For each
 * scenario: lobby idle, lobby while throwing, stage corridor, stage while
 * throwing. Also measures time-to-playable on emulated 4G.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client, type Room } from '@colyseus/sdk'
import { C2S, ROOM_NAME, SPAWN } from '@game/shared'
import { type BrowserContext, chromium, type Page } from 'playwright-core'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, 'out')
mkdirSync(out, { recursive: true })

const args = process.argv.slice(2)
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : fallback
}
const URL = arg('url', 'http://localhost:4173/')
const SERVER = arg('server', 'http://localhost:2567')
const BOTS = Number(arg('bots', '7'))
/** Runs per scenario; each view reports its median-FPS run (machine noise is large). */
const REPEAT = Number(arg('repeat', '1'))
/** Only scenarios whose name contains this (e.g. --only mobile). */
const ONLY = arg('only', '').toLowerCase()
const RUN = Date.now().toString(36)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* ---------------------------------------------------------------------------
 * Bots: wander around the spawn plaza, throwing, each with a pet.
 * ------------------------------------------------------------------------- */

async function spawnBots(n: number): Promise<{ rooms: Room[]; stop: () => void }> {
  const rooms: Room[] = []
  for (let i = 0; i < n; i += 1) {
    const client = new Client(SERVER)
    const room = await client.joinOrCreate(ROOM_NAME, { playerId: `probe-${RUN}-${i}`.padEnd(20, '0'), name: `Bot${i}` })
    room.onMessage('*', () => {})
    room.send(C2S.redeemCode, { code: 'RELEASE' })
    room.send(C2S.redeemCode, { code: '100LIKES' })
    setTimeout(() => room.send(C2S.buyGemItem, { item: 'starterPack' }), 500)
    rooms.push(room)
  }
  let t = 0
  const timer = setInterval(() => {
    t += 0.1
    rooms.forEach((room, i) => {
      const a = t * 0.4 + (i / rooms.length) * Math.PI * 2
      const x = SPAWN.x + Math.cos(a) * 9
      const z = SPAWN.z - 6 + Math.sin(a) * 9
      room.send(C2S.move, { x, y: 0, z, r: a + Math.PI, a: 1 })
      if (Math.round(t * 10) % 3 === i % 3) room.send(C2S.throw, { s: Math.round(t * 10) })
    })
  }, 100)
  return { rooms, stop: () => clearInterval(timer) }
}

/* ---------------------------------------------------------------------------
 * Measurement helpers (run inside the page)
 * ------------------------------------------------------------------------- */

interface Sample {
  fps: number
  worstFrameMs: number
  p95FrameMs: number
  callsMax: number
  callsAvg: number
  trisMax: number
  trisAvg: number
}

/**
 * Runs in the page. Kept as a plain string: tsx would wrap named inner functions
 * in a `__name()` helper that doesn't exist inside the browser.
 */
const MEASURE_SRC = `async (duration) => {
  const frames = []
  let calls = 0, callsMax = 0, tris = 0, trisMax = 0, n = 0
  const t0 = performance.now()
  let last = t0
  await new Promise((resolve) => {
    function tick(t) {
      frames.push(t - last)
      last = t
      const info = window.__bpcRenderInfo && window.__bpcRenderInfo()
      if (info) {
        calls += info.calls; tris += info.triangles
        callsMax = Math.max(callsMax, info.calls); trisMax = Math.max(trisMax, info.triangles)
        n += 1
      }
      if (t - t0 < duration) requestAnimationFrame(tick)
      else resolve()
    }
    requestAnimationFrame(tick)
  })
  const elapsed = (performance.now() - t0) / 1000
  const sorted = frames.slice(1).sort((a, b) => a - b)
  return {
    fps: frames.length / elapsed,
    worstFrameMs: sorted[sorted.length - 1] || 0,
    p95FrameMs: sorted[Math.floor(sorted.length * 0.95)] || 0,
    callsMax, callsAvg: n ? calls / n : 0,
    trisMax, trisAvg: n ? tris / n : 0,
  }
}`

async function measure(page: Page, ms: number): Promise<Sample> {
  return page.evaluate(`(${MEASURE_SRC})(${ms})`) as Promise<Sample>
}

async function throwWhile(page: Page, mobile: boolean, ms: number): Promise<void> {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (mobile) await page.touchscreen.tap(420, 200)
    else await page.mouse.click(800, 420)
    await sleep(100)
  }
}

interface Scenario {
  name: string
  preset: 'LOW' | 'MEDIUM' | 'HIGH'
  mobile: boolean
  cpuThrottle: number
}

const SCENARIOS: Scenario[] = [
  { name: 'Desktop HIGH', preset: 'HIGH', mobile: false, cpuThrottle: 1 },
  { name: 'Desktop MEDIUM', preset: 'MEDIUM', mobile: false, cpuThrottle: 1 },
  { name: 'Mobile LOW (4x CPU throttle)', preset: 'LOW', mobile: true, cpuThrottle: 4 },
]

async function newContext(browser: Awaited<ReturnType<typeof chromium.launch>>, sc: Scenario): Promise<BrowserContext> {
  const context = await browser.newContext(
    sc.mobile
      ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { viewport: { width: 1600, height: 900 } },
  )
  await context.addInitScript(
    ([preset, name]) => {
      localStorage.setItem('bpc:settings', JSON.stringify({ preset, auto: false, music: false, sfx: false, hideOtherPets: false }))
      localStorage.setItem('bpc:name', name)
    },
    [sc.preset, `Probe${sc.preset}`],
  )
  return context
}

async function runScenario(browser: Awaited<ReturnType<typeof chromium.launch>>, sc: Scenario) {
  const context = await newContext(browser, sc)
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const cdp = await context.newCDPSession(page)
  if (sc.cpuThrottle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: sc.cpuThrottle })

  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.locator('.hud').waitFor({ timeout: 60000 })
  await sleep(4000)

  const lobby = await measure(page, 4000)
  const [lobbyCombat] = await Promise.all([measure(page, 4000), throwWhile(page, sc.mobile, 4000)])
  const lobbyTextures = await page.evaluate(() => window.__bpcTextureStats?.() ?? null)

  // Into stage 1 through Settings → Stages (what a player would do).
  await page.locator('button[aria-label="Settings"]').click()
  await page.locator('button', { hasText: 'Stages' }).first().click()
  await page.locator('[data-stage="1"]').click()
  await sleep(3500)
  const stage = await measure(page, 4000)
  const [stageCombat] = await Promise.all([measure(page, 4000), throwWhile(page, sc.mobile, 4000)])
  const stageTextures = await page.evaluate(() => window.__bpcTextureStats?.() ?? null)
  const heap = await page.evaluate(() => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0)
  await page.screenshot({ path: path.join(out, `perf-${sc.preset.toLowerCase()}.png`) })
  await context.close()
  return { scenario: sc, lobby, lobbyCombat, stage, stageCombat, lobbyTextures, stageTextures, heap, errors }
}

/** Fresh visitor on emulated 4G: navigation → HUD visible (name already chosen). */
async function timeToPlayable(browser: Awaited<ReturnType<typeof chromium.launch>>, profile: { name: string; down: number; up: number; latency: number }) {
  const sc: Scenario = { name: profile.name, preset: 'LOW', mobile: true, cpuThrottle: 4 }
  const context = await newContext(browser, sc)
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: profile.latency,
    downloadThroughput: (profile.down * 1024 * 1024) / 8,
    uploadThroughput: (profile.up * 1024 * 1024) / 8,
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  let bytes = 0
  cdp.on('Network.loadingFinished', (e: { encodedDataLength: number }) => {
    bytes += e.encodedDataLength
  })
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  // "Playable" = connected, avatar assembled and a frame drawn (the app's own mark).
  await page.waitForFunction(() => performance.getEntriesByName('bpc:playable').length > 0, null, { timeout: 90000 })
  const timeline = (await page.evaluate(`(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const marks = {}
    for (const m of performance.getEntriesByType('mark')) if (m.name.startsWith('bpc:')) marks[m.name.slice(4)] = m.startTime
    return { dcl: nav ? nav.domContentLoadedEventEnd : 0, load: nav ? nav.loadEventEnd : 0, marks }
  })()`)) as { dcl: number; load: number; marks: Record<string, number> }
  await context.close()
  return { profile, seconds: timeline.marks.playable / 1000, transferred: bytes, timeline }
}

const fmt = (n: number, d = 0) => n.toFixed(d)
const kb = (b: number) => `${(b / 1024).toFixed(0)} KB`
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`

const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-precise-memory-info'],
})

console.log(`Spawning ${BOTS} bots…`)
const bots = await spawnBots(BOTS)
await sleep(2000)

const byFps = <T extends { fps: number }>(xs: T[]) => [...xs].sort((a, b) => a.fps - b.fps)[Math.floor(xs.length / 2)]
const results = []
for (const sc of SCENARIOS.filter((x) => x.name.toLowerCase().includes(ONLY))) {
  console.log(`Measuring ${sc.name}${REPEAT > 1 ? ` (${REPEAT} runs)` : ''}…`)
  const runs = []
  for (let k = 0; k < REPEAT; k += 1) runs.push(await runScenario(browser, sc))
  const r = runs[0]
  r.lobby = byFps(runs.map((x) => x.lobby))
  r.lobbyCombat = byFps(runs.map((x) => x.lobbyCombat))
  r.stage = byFps(runs.map((x) => x.stage))
  r.stageCombat = byFps(runs.map((x) => x.stageCombat))
  results.push(r)
}
bots.stop()
for (const r of bots.rooms) await r.leave(true).catch(() => {})

console.log('Measuring time to playable…')
/** Median of REPEAT loads. */
async function ttpMedian(profile: { name: string; down: number; up: number; latency: number }) {
  const runs = []
  for (let k = 0; k < REPEAT; k += 1) runs.push(await timeToPlayable(browser, profile))
  return [...runs].sort((a, b) => a.seconds - b.seconds)[Math.floor(runs.length / 2)]
}
const ttp = [
  await ttpMedian({ name: 'Fast 4G (9 Mbps, 60 ms)', down: 9, up: 1.5, latency: 60 }),
  await ttpMedian({ name: 'Slow 4G (1.6 Mbps, 150 ms)', down: 1.6, up: 0.75, latency: 150 }),
]
await browser.close()

const lines: string[] = []
lines.push('# Perf probe results', '')
lines.push(`Production build at ${URL}, ${BOTS} bot players + the probe in one room (8 players). Headless Edge on this machine.`, '')
lines.push('| Scenario | View | FPS | p95 frame | Worst frame | Draw calls (avg / max) | Triangles (avg / max) |')
lines.push('|---|---|---|---|---|---|---|')
for (const r of results) {
  for (const [view, s] of [
    ['Lobby', r.lobby],
    ['Lobby + throwing', r.lobbyCombat],
    ['Stage 1', r.stage],
    ['Stage 1 + throwing', r.stageCombat],
  ] as const) {
    lines.push(
      `| ${r.scenario.name} | ${view} | ${fmt(s.fps)} | ${fmt(s.p95FrameMs, 1)} ms | ${fmt(s.worstFrameMs, 1)} ms | ${fmt(s.callsAvg)} / ${s.callsMax} | ${fmt(s.trisAvg / 1000, 1)}k / ${fmt(s.trisMax / 1000, 1)}k |`,
    )
  }
}
lines.push('', '| Scenario | Textures in scene (lobby / stage) | Est. GPU texture memory (lobby / stage) | Largest texture | JS heap |')
lines.push('|---|---|---|---|---|')
for (const r of results) {
  lines.push(
    `| ${r.scenario.name} | ${r.lobbyTextures?.count} / ${r.stageTextures?.count} | ${mb(r.lobbyTextures?.bytes ?? 0)} / ${mb(r.stageTextures?.bytes ?? 0)} | ${Math.max(r.lobbyTextures?.largest ?? 0, r.stageTextures?.largest ?? 0)} px | ${mb(r.heap)} |`,
  )
}
lines.push(
  '',
  '| Time to playable (mobile LOW, 4× CPU throttle, cache disabled) | Playable | DOMContentLoaded | SDK ready | Joined | Avatar | First frame | Transferred |',
  '|---|---|---|---|---|---|---|---|',
)
const sec = (ms?: number) => (ms === undefined ? '—' : `${(ms / 1000).toFixed(1)} s`)
for (const t of ttp) {
  const m = t.timeline.marks
  lines.push(
    `| ${t.profile.name} | **${fmt(t.seconds, 1)} s** | ${sec(t.timeline.dcl)} | ${sec(m.sdk)} | ${sec(m.joined)} | ${sec(m.avatar)} | ${sec(m['first-frame'])} | ${kb(t.transferred)} |`,
  )
}
const errs = results.flatMap((r) => r.errors)
lines.push('', errs.length ? `Page errors: ${errs.join('; ')}` : 'No page errors.')

const report = lines.join('\n')
writeFileSync(path.join(out, 'perf-report.md'), report)
console.log(report)
process.exit(0)
