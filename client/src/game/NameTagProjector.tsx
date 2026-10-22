import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'

import { remotePlayers } from '../net/remote'
import { tagEntries } from './nameTags'

const _v = new Vector3()
const TAG_HEIGHT = 2.9

/** Projects each registered name tag onto the screen; transform-only DOM writes. */
export function NameTagProjector() {
  useFrame(({ camera, size }) => {
    for (let i = 0; i < tagEntries.length; i += 1) {
      const tag = tagEntries[i]
      const p = remotePlayers.get(tag.id)
      if (!p) continue
      _v.set(p.px, p.py + TAG_HEIGHT, p.pz).project(camera)
      const visible = _v.z < 1 && _v.x > -1.2 && _v.x < 1.2 && _v.y > -1.2 && _v.y < 1.2
      if (visible !== tag.shown) {
        tag.shown = visible
        tag.el.style.visibility = visible ? 'visible' : 'hidden'
      }
      if (!visible) continue
      const x = (_v.x * 0.5 + 0.5) * size.width
      const y = (-_v.y * 0.5 + 0.5) * size.height
      if (Math.abs(x - tag.x) < 0.5 && Math.abs(y - tag.y) < 0.5) continue
      tag.x = x
      tag.y = y
      tag.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`
    }
  })
  return null
}

export default NameTagProjector
