/**
 * Guest account: a random UUID kept in localStorage is the account key. There is
 * no name screen: the display name is the Bloxity name when there is one, else an
 * automatic "Player1234" (changeable in Settings).
 */

const ID_KEY = 'bpc:playerId'
const NAME_KEY = 'bpc:name'
/** '1' while the saved name is automatic, so a Bloxity name may replace it. */
const NAME_AUTO_KEY = 'bpc:nameAuto'

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // Fallback for non-secure contexts (plain-http LAN testing).
  let s = ''
  for (let i = 0; i < 32; i += 1) s += Math.floor(Math.random() * 16).toString(16)
  return s
}

const memory: Record<string, string> = {}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return memory[key] ?? null
  }
}

function write(key: string, value: string): void {
  memory[key] = value
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage blocked: this tab keeps an in-memory identity.
  }
}

export function getPlayerId(): string {
  let id = read(ID_KEY)
  if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
    id = randomId()
    write(ID_KEY, id)
  }
  return id
}

export function getSavedName(): string | null {
  return read(NAME_KEY)
}

/** A name the player chose (Settings). */
export function saveName(name: string): void {
  write(NAME_KEY, name)
  write(NAME_AUTO_KEY, '0')
}

/** The name to join with: the saved one, or a new automatic one. */
export function getOrCreateName(): string {
  const saved = read(NAME_KEY)
  if (saved) return saved
  const auto = `Player${Math.floor(1000 + Math.random() * 9000)}`
  write(NAME_KEY, auto)
  write(NAME_AUTO_KEY, '1')
  return auto
}

/**
 * Adopts the Bloxity display name unless the player picked their own. Returns the
 * new name when it changed, so the caller can tell the server.
 */
export function adoptBloxityName(bloxityName: string): string | null {
  if (!bloxityName || read(NAME_AUTO_KEY) === '0') return null
  if (read(NAME_KEY) === bloxityName) return null
  write(NAME_KEY, bloxityName)
  write(NAME_AUTO_KEY, '1')
  return bloxityName
}
