import { dailyCanClaim, dailyNextDay, formatTimer, PLAYTIME_GIFTS, questProgress } from '@game/shared'

import { useGame } from '../../state/gameStore'
import { useServerClock } from '../hooks'

export interface RewardAlerts {
  /** A playtime gift can be claimed. */
  gift: boolean
  /** "CLAIM!", the countdown to the next gift, or "DONE". */
  giftCaption: string
  daily: boolean
  dailyDay: number
  quest: boolean
  any: boolean
}

/** What's waiting to be claimed. Re-renders once a second (the gift countdown). */
export function useRewardAlerts(): RewardAlerts | null {
  const data = useGame((s) => s.data)
  const syncedAt = useGame((s) => s.syncedAt)
  const now = useServerClock(1000)
  if (!data) return null

  // Playtime advances locally between server syncs.
  const playSeconds = data.playtime.seconds + Math.max(0, (Date.now() - syncedAt) / 1000)
  const unclaimed = PLAYTIME_GIFTS.findIndex((_g, i) => !data.playtime.claimed.includes(i))
  const gift = PLAYTIME_GIFTS.some((g, i) => !data.playtime.claimed.includes(i) && playSeconds >= g.minutes * 60)
  const nextGift = unclaimed >= 0 ? PLAYTIME_GIFTS[unclaimed] : null
  const giftCaption = gift ? 'CLAIM!' : nextGift ? formatTimer(nextGift.minutes * 60 - playSeconds) : 'DONE'

  const daily = dailyCanClaim(data, now)
  const quest = [data.dailyQuests, data.weeklyQuests].some((book) =>
    book.quests.some((q) => {
      if (q.claimed) return false
      const p = questProgress(data, book, q.id)
      return p.value >= p.target
    }),
  )
  return { gift, giftCaption, daily, dailyDay: dailyNextDay(data, now), quest, any: gift || daily || quest }
}
