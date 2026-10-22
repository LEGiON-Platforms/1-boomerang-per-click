import { memo, useCallback } from 'react'

import { registerTag, unregisterTag } from '../game/nameTags'
import { useGame } from '../state/gameStore'

const Tag = memo(function Tag({ id, name, level }: { id: string; name: string; level: number }) {
  // Callback ref: register on mount, unregister on unmount.
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      if (el) registerTag(id, el)
      else unregisterTag(id)
    },
    [id],
  )
  return (
    <div ref={ref} className="nametag txt-outline">
      {name}
      <span className="nametag-level">Lv {level}</span>
    </div>
  )
})

/** Tags for nearby players; positioned each frame by game/NameTagProjector. */
export function NameTags() {
  const tags = useGame((s) => s.nearbyTags)
  const players = useGame((s) => s.roomPlayers)
  return (
    <div className="nametag-layer">
      {players
        .filter((p) => !p.isLocal && tags.includes(p.sessionId))
        .map((p) => (
          <Tag key={p.sessionId} id={p.sessionId} name={p.name} level={p.level} />
        ))}
    </div>
  )
}
