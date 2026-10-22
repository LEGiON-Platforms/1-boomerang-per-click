import {
  BOOSTS,
  bestUnlockedEgg,
  EGG_BY_ID,
  formatNumber,
  PET_BY_ID,
  type PlayerData,
  RARITY,
  type RewardDef,
  type RewardSummary,
  rewardWins,
} from '@game/shared'

export interface RewardLine {
  text: string
  color: string
}

/** What a reward *will* give this player (gift/quest/daily previews). */
export function describeReward(r: RewardDef, d: PlayerData): RewardLine[] {
  const out: RewardLine[] = []
  if (r.winsPads) out.push({ text: `+${formatNumber(rewardWins(d, r.winsPads))} Wins`, color: '#5dff7a' })
  if (r.gems) out.push({ text: `+${r.gems} Gems`, color: '#3ee0b4' })
  if (r.pumpkins) out.push({ text: `+${r.pumpkins} Pumpkins`, color: '#ff9a2f' })
  for (const b of r.boosts ?? []) out.push({ text: `${BOOSTS[b.id].name} ${b.minutes}m`, color: BOOSTS[b.id].color })
  if (r.egg) {
    const egg = r.egg === 'best' ? bestUnlockedEgg(d) : EGG_BY_ID[r.egg]
    out.push({ text: `Free ${egg.name}`, color: '#ffe14a' })
  }
  if (r.pet) out.push({ text: `${PET_BY_ID[r.pet.id]?.name} (${RARITY[r.pet.rarity].name})`, color: RARITY[r.pet.rarity].color })
  return out
}

/** What a reward actually gave (reward popup). */
export function describeSummary(s: RewardSummary): RewardLine[] {
  const out: RewardLine[] = []
  if (s.wins) out.push({ text: `+${formatNumber(s.wins)} Wins`, color: '#5dff7a' })
  if (s.gems) out.push({ text: `+${s.gems} Gems`, color: '#3ee0b4' })
  if (s.pumpkins) out.push({ text: `+${s.pumpkins} Pumpkins`, color: '#ff9a2f' })
  for (const b of s.boosts) out.push({ text: `${BOOSTS[b.id].name} ${b.minutes}m`, color: BOOSTS[b.id].color })
  for (const p of s.pets) {
    out.push({ text: `${p.golden ? 'Golden ' : ''}${PET_BY_ID[p.petId]?.name} (${RARITY[p.rarity].name})`, color: RARITY[p.rarity].color })
  }
  if (s.vip) out.push({ text: 'VIP Boomerang!', color: '#ffb300' })
  if (s.convertedGems && !s.gems) out.push({ text: `Inventory full: +${s.convertedGems} Gems instead`, color: '#3ee0b4' })
  return out
}
