/** Error codes returned by actions, with the text the client toasts. */

export const ERRORS = {
  not_enough_wins: 'Not enough Wins!',
  not_enough_gems: 'Not enough Gems!',
  not_enough_pumpkins: 'Not enough Pumpkins!',
  all_owned: 'You already own them all!',
  already_owned: 'Already owned!',
  not_owned: "You don't own that yet!",
  egg_locked: 'This egg is still locked!',
  inventory_full: 'Pet inventory is full! Merge or delete some pets.',
  no_slots: 'All pet slots are full!',
  not_found: 'Not found.',
  not_enough_pets: 'You need 5 identical pets to merge!',
  too_far: 'Get closer first!',
  not_ready: 'Not ready yet!',
  already_claimed: 'Already claimed!',
  invalid_code: 'Invalid code!',
  code_used: 'Code already redeemed!',
  offer_expired: 'This offer has expired!',
  stage_locked: 'Clear the previous stage first!',
  walls_remaining: 'Break all the walls first!',
  triple_locked: 'Open 3 unlocks at Rebirth 2!',
  bad_request: 'Something went wrong.',
} as const

export type ErrorCode = keyof typeof ERRORS

export type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: ErrorCode }

export const fail = (error: ErrorCode): { ok: false; error: ErrorCode } => ({ ok: false, error })
