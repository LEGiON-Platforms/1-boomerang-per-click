import { BOOSTS, formatNumber, type PlayerData, type RewardDef, type RewardSummary, rewardWins } from '@game/shared'

export interface RewardLine {
  text: string
  color: string
}

/** What a reward *will* give this player (gift/quest/daily previews). */
export function describeReward(r: RewardDef, d: PlayerData): RewardLine[] {
  const out: RewardLine[] = []
  if (r.winsPads) out.push({ text: `+${formatNumber(rewardWins(d, r.winsPads))} Wins`, color: '#5dff7a' })
  if (r.pumpkins) out.push({ text: `+${r.pumpkins} Pumpkins`, color: '#ff9a2f' })
  for (const b of r.boosts ?? []) out.push({ text: `${BOOSTS[b.id].name} ${b.minutes}m`, color: BOOSTS[b.id].color })
  return out
}

/** What a reward actually gave (reward popup). */
export function describeSummary(s: RewardSummary): RewardLine[] {
  const out: RewardLine[] = []
  if (s.wins) out.push({ text: `+${formatNumber(s.wins)} Wins`, color: '#5dff7a' })
  if (s.pumpkins) out.push({ text: `+${s.pumpkins} Pumpkins`, color: '#ff9a2f' })
  for (const b of s.boosts) out.push({ text: `${BOOSTS[b.id].name} ${b.minutes}m`, color: BOOSTS[b.id].color })
  if (s.vip) out.push({ text: 'VIP Boomerang!', color: '#ffb300' })
  return out
}
