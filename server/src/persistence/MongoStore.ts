import mongoose, { Schema } from 'mongoose'

import type { LeaderboardEntry, PlayerData } from '@game/shared'

import type { LeaderboardField, PlayerStore } from './Store'

interface PlayerDoc {
  _id: string
  name: string
  totalWins: number
  bestStageEver: number
  rebirths: number
  data: PlayerData
  updatedAt: Date
}

/**
 * Production store. The full record is kept as one document; the leaderboard
 * fields are copied to indexed top-level columns so the boards are a cheap
 * sorted query.
 */
const playerSchema = new Schema<PlayerDoc>(
  {
    _id: { type: String, required: true },
    name: { type: String, default: '' },
    totalWins: { type: Number, default: 0, index: true },
    bestStageEver: { type: Number, default: 0, index: true },
    rebirths: { type: Number, default: 0, index: true },
    data: { type: Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false, minimize: false },
)

export class MongoStore implements PlayerStore {
  readonly kind = 'mongo' as const
  private model = mongoose.models.Player ?? mongoose.model<PlayerDoc>('Player', playerSchema)

  constructor(private url: string) {}

  async init(): Promise<void> {
    await mongoose.connect(this.url)
    await this.model.syncIndexes()
  }

  async load(id: string): Promise<unknown | null> {
    const doc = await this.model.findById(id).lean<PlayerDoc>()
    return doc?.data ?? null
  }

  async save(data: PlayerData): Promise<void> {
    await this.model.updateOne(
      { _id: data.id },
      {
        $set: {
          name: data.name,
          totalWins: data.totalWins,
          bestStageEver: data.bestStageEver,
          rebirths: data.rebirths,
          data,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    )
  }

  async top(field: LeaderboardField, limit: number): Promise<LeaderboardEntry[]> {
    const docs = await this.model
      .find({ [field]: { $gt: 0 } })
      .sort({ [field]: -1 })
      .limit(limit)
      .select({ name: 1, [field]: 1 })
      .lean<PlayerDoc[]>()
    return docs.map((d) => ({ name: d.name, value: d[field] }))
  }

  async close(): Promise<void> {
    await mongoose.disconnect()
  }
}
