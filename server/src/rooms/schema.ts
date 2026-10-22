import { schema, type SchemaType, t } from '@colyseus/schema'

/**
 * Public, room-wide state: what every player may see of every other player.
 * Private economy data never goes in here — it is sent to its owner directly.
 */
export const PlayerState = schema(
  {
    name: t.string().default(''),
    /** Public id (hash of the account key) — the key for friend lists. */
    pid: t.string().default(''),
    x: t.float32().default(0),
    y: t.float32().default(0),
    z: t.float32().default(0),
    rotY: t.float32().default(0),
    anim: t.uint8().default(0),
    /** Best owned boomerang id; `vip` swaps in the event boomerang look. */
    boomerang: t.uint8().default(0),
    vip: t.boolean().default(false),
    trail: t.uint8().default(0),
    level: t.uint16().default(1),
    rebirths: t.uint16().default(0),
    /** Stage area the player is standing in (0 = lobby). */
    stage: t.uint8().default(0),
    /** Increments on every throw so other clients can play the animation. */
    throws: t.uint16().default(0),
    /** Equipped pets, encoded "petId:rarityIndex:golden". */
    pets: t.array('string'),
  },
  'PlayerState',
)
export type PlayerState = SchemaType<typeof PlayerState>

export const LuckyState = schema(
  {
    /** LUCKY_PHASE: 0 counting down to the next drop, 1 a block is waiting to be found. */
    phase: t.uint8().default(0),
    secondsLeft: t.uint16().default(0),
    x: t.float32().default(0),
    z: t.float32().default(0),
  },
  'LuckyState',
)
export type LuckyState = SchemaType<typeof LuckyState>

export const GameState = schema(
  {
    players: t.map(PlayerState),
    lucky: LuckyState,
  },
  'GameState',
)
export type GameState = SchemaType<typeof GameState>
