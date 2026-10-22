/**
 * Guest account: a random UUID kept in localStorage is the account key; the
 * display name is chosen once and remembered.
 */

const ID_KEY = 'bpc:playerId'
const NAME_KEY = 'bpc:name'

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

export function saveName(name: string): void {
  write(NAME_KEY, name)
}
