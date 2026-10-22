import { useEffect, useMemo } from 'react'
import { MeshBasicMaterial } from 'three'

import { disposeSignPages, type SignPage } from './signs'

/**
 * Draws sign pages (see signs.ts): one mesh and material per page. Owns them —
 * when `pages` is replaced, the old pages' GPU resources are released.
 */
export function SignPagesMesh({ pages, transparent = false, renderOrder = 0 }: { pages: SignPage[]; transparent?: boolean; renderOrder?: number }) {
  const materials = useMemo(
    () =>
      pages.map(
        (p) => new MeshBasicMaterial({ map: p.texture, transparent, depthWrite: !transparent, toneMapped: false }),
      ),
    [pages, transparent],
  )
  useEffect(
    () => () => {
      for (const m of materials) m.dispose()
    },
    [materials],
  )
  useEffect(() => () => disposeSignPages(pages), [pages])
  return (
    <>
      {pages.map((p, i) => (
        <mesh key={i} geometry={p.geometry} material={materials[i]} renderOrder={renderOrder} />
      ))}
    </>
  )
}
