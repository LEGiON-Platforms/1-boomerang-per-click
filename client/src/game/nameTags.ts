/**
 * Name tags for other players: plain DOM elements (rendered by ui/NameTags.tsx)
 * positioned by one projector in the frame loop. Cheaper than one drei <Html> per
 * player — it writes a transform only when a tag actually moves.
 */

export interface TagEntry {
  id: string
  el: HTMLElement
  x: number
  y: number
  shown: boolean
}

export const tagEntries: TagEntry[] = []

export function registerTag(id: string, el: HTMLElement): void {
  unregisterTag(id)
  tagEntries.push({ id, el, x: -1e5, y: -1e5, shown: true })
}

export function unregisterTag(id: string): void {
  const i = tagEntries.findIndex((t) => t.id === id)
  if (i >= 0) tagEntries.splice(i, 1)
}
