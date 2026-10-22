/**
 * Balance simulator report.
 *
 *   npm run simulate                 # default: 5 clicks/s, up to 40 h
 *   npm run simulate -- --hours 60
 *   npm run simulate -- --cps 4
 *
 * Plays an "optimal" player through the real shared economy (see sim-core.ts):
 * it clicks at a steady rate while sprinting, buys the next boomerang/trail as soon
 * as it is affordable, rebirths once the rebirth is affordable and nothing cheaper
 * is left to buy, and at every decision picks the closer milestone — clearing the
 * next stage (after the optimal amount of pad training) or affording the next
 * purchase by farming its best cleared stage. No pets, boosts, gems or events: this
 * is the baseline curve every other system speeds up.
 */

import {
  BOOMERANGS,
  formatNumber,
  padWins,
  LEVEL,
  REBIRTH,
  rebirthLevel,
  STAGE_COUNT,
  stageTotalHp,
  TRAILS,
  WALL_HP,
} from '@game/shared'

import { runSimulation } from './sim-core'

const args = process.argv.slice(2)
const arg = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? Number(args[i + 1]) : fallback
}

const cps = arg('cps', 5)
const result = runSimulation({ cps, maxHours: arg('hours', 40) })
const { stageReached, rebirths, endTime, player } = result

export const fmtTime = (s: number) => {
  if (!Number.isFinite(s)) return '—'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(sec).padStart(2, '0')}s`
}

const TARGETS: Record<number, string> = { 1: '< 1 min', 5: '8–12 min', 10: '≈ 1 h', 20: '6–8 h', 30: '20–30 h' }

const out: string[] = []
out.push('')
out.push(`+1 Boomerang Per Click — balance simulation (${cps} clicks/s, sprinting, no pets/boosts)`)
out.push('')
out.push('Config under test:')
out.push(
  `  wallHP     = round(${WALL_HP.base} × Π growth(2..s) × (1 + ${WALL_HP.perWall} × (w-1))), ` +
    `growth tapers ${WALL_HP.earlyGrowth} → ${WALL_HP.lateGrowth} over ${WALL_HP.taper} stages`,
)
out.push(`  rebirth n  = level ${REBIRTH.levelStep}·n; XP to level 2 = ${LEVEL.base}, growth ${LEVEL.earlyGrowth} → ${LEVEL.lateGrowth} over ${LEVEL.taper} levels`)
out.push(`  boomerangs = ${BOOMERANGS.map((b) => formatNumber(b.cost)).join(', ')}`)
out.push('')
out.push('Stage | First cleared | Rebirths by then | Stage HP (10 walls) | Pad wins | Target')
out.push('------|---------------|------------------|---------------------|----------|---------')
for (let s = 1; s <= STAGE_COUNT; s += 1) {
  const t = stageReached[s - 1]
  const rb = t === undefined ? '—' : String(rebirths.filter((r) => r.t <= t).length)
  out.push(
    `${String(s).padStart(5)} | ${fmtTime(t ?? Infinity).padStart(13)} | ${rb.padStart(16)} | ${formatNumber(stageTotalHp(s)).padStart(19)} | ${formatNumber(padWins(s)).padStart(8)} | ${TARGETS[s] ?? ''}`,
  )
}
out.push('')
out.push('Rebirth | At time   | Highest stage before | Level')
out.push('--------|-----------|----------------------|------')
for (const r of rebirths.slice(0, 40)) {
  out.push(
    `${String(r.r).padStart(7)} | ${fmtTime(r.t).padStart(9)} | ${String(r.stage).padStart(20)} | ${rebirthLevel(r.r - 1)}`,
  )
}
out.push('')
out.push(
  `Finished at ${fmtTime(endTime)}: best stage ${player.bestStageEver}, rebirths ${player.rebirths}, ` +
    `boomerang ${BOOMERANGS[player.boomerangsOwned - 1].name}, trail ${TRAILS[player.equippedTrail].name}`,
)

const within = (t: number | undefined, min: number, max: number) => t !== undefined && t >= min && t <= max
const line = (ok: boolean, label: string, t: number | undefined, target: string) =>
  `${ok ? 'PASS' : 'FAIL'}  ${label}: ${fmtTime(t ?? Infinity)} (target ${target})`

out.push('')
out.push('Targets:')
out.push(line(within(stageReached[0], 0, 60), 'Stage 1', stageReached[0], TARGETS[1]))
out.push(line(within(stageReached[4], 8 * 60, 12 * 60), 'Stage 5', stageReached[4], TARGETS[5]))
out.push(line(within(rebirths[0]?.t, 15 * 60, 25 * 60), 'First rebirth', rebirths[0]?.t, '15–25 min'))
out.push(line(within(stageReached[9], 45 * 60, 75 * 60), 'Stage 10', stageReached[9], TARGETS[10]))
out.push(line(within(stageReached[19], 6 * 3600, 8 * 3600), 'Stage 20', stageReached[19], TARGETS[20]))
out.push(line(within(stageReached[29], 20 * 3600, 30 * 3600), 'Stage 30', stageReached[29], TARGETS[30]))
console.log(out.join('\n'))
