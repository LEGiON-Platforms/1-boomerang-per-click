import { EGG_SPOTS, LEADERBOARD_SPOTS, REBIRTH_STATUE, SPAWN, TRAILS_STALL } from '@game/shared'
import { type BufferGeometry, CylinderGeometry, Float32BufferAttribute } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { createWorldBoxGeometry } from '../textures'

/**
 * The lobby's paving, laid over the grass: a round spawn plaza with a darker ring,
 * and slab paths out to the gate, the training pads, the Boomerang Stage, the
 * eggs and the leaderboards, with loose stepping stones along their edges.
 *
 * Every piece is a thin textured slab at its own height (a few millimetres apart),
 * so overlapping pieces never share a plane and never z-fight. A per-piece vertex
 * tint varies the grey from slab to slab. One merged geometry = one draw call.
 */

const TILE = 2

/** Heights (top surface) per layer, in metres. */
const H = { stone: 0.018, pathA: 0.026, pathB: 0.032, plaza: 0.04, ring: 0.05 }

interface Piece {
  geo: BufferGeometry
  tint: number
}

function slab(pieces: Piece[], minX: number, maxX: number, minZ: number, maxZ: number, top: number, tint = 1): void {
  const g = createWorldBoxGeometry(maxX - minX, top, maxZ - minZ, TILE)
  g.translate((minX + maxX) / 2, top / 2, (minZ + maxZ) / 2)
  pieces.push({ geo: g, tint })
}

/** A disc with planar world UVs (so its studs line up with the world grid). */
function disc(pieces: Piece[], x: number, z: number, r: number, top: number, tint: number): void {
  const g = new CylinderGeometry(r, r, top, 40)
  g.translate(x, top / 2, z)
  const pos = g.getAttribute('position')
  const uv = g.getAttribute('uv')
  for (let i = 0; i < pos.count; i += 1) uv.setXY(i, pos.getX(i) / TILE, pos.getZ(i) / TILE)
  pieces.push({ geo: g, tint })
}

/** A straight path with stepping stones scattered along both long edges. */
function path(pieces: Piece[], minX: number, maxX: number, minZ: number, maxZ: number, layer: number, seed: number): void {
  const top = layer % 2 ? H.pathB : H.pathA
  slab(pieces, minX, maxX, minZ, maxZ, top, 0.97)
  const alongX = maxX - minX > maxZ - minZ
  const length = alongX ? maxX - minX : maxZ - minZ
  for (let d = 1.5, k = seed; d < length - 1.5; d += 3.2, k += 1) {
    const side = k % 2 ? 1 : -1
    const size = 1.6 + ((k * 7) % 5) * 0.2
    const out = 0.4 + ((k * 3) % 4) * 0.3
    const tint = 0.9 + ((k * 5) % 4) * 0.025
    if (alongX) {
      const x = minX + d
      const z = side > 0 ? maxZ + out : minZ - out
      slab(pieces, x - size / 2, x + size / 2, z - size / 2, z + size / 2, H.stone, tint)
    } else {
      const z = minZ + d
      const x = side > 0 ? maxX + out : minX - out
      slab(pieces, x - size / 2, x + size / 2, z - size / 2, z + size / 2, H.stone, tint)
    }
  }
}

export function buildPaving(): BufferGeometry {
  const pieces: Piece[] = []

  // Spawn plaza and its darker ring.
  disc(pieces, SPAWN.x, SPAWN.z, 11, H.plaza, 1)
  disc(pieces, SPAWN.x, SPAWN.z, 6.5, H.ring, 0.88)

  // North to the stage gate (under the arch, into the corridor's mouth).
  path(pieces, -6, 6, -4, 16, 0, 1)
  // West to the training pads, then the long strip the pads stand on.
  path(pieces, -26, -10, 22, 30, 1, 2)
  path(pieces, -34, -26, 4, 54, 0, 3)
  // East to the Boomerang Stage.
  path(pieces, 10, 31, 22, 30, 1, 4)
  // South to the eggs, the egg row, and the walk in front of the leaderboards.
  path(pieces, -5, 5, 36, 54, 0, 5)
  const eggMinX = Math.min(...EGG_SPOTS.map((e) => e.x)) - 4
  const eggMaxX = Math.max(...EGG_SPOTS.map((e) => e.x)) + 4
  path(pieces, eggMinX, eggMaxX, 54, 62, 1, 6)
  const lbMinX = Math.min(...LEADERBOARD_SPOTS.map((l) => l.x)) - 7
  const lbMaxX = Math.max(...LEADERBOARD_SPOTS.map((l) => l.x)) + 7
  path(pieces, lbMinX, lbMaxX, 63, 68, 0, 7)
  // Side trips: the trails stall (north-west) and the rebirth statue (south-east).
  path(pieces, TRAILS_STALL.x - 6, TRAILS_STALL.x + 6, TRAILS_STALL.z + 1, TRAILS_STALL.z + 6, 1, 8)
  path(pieces, -12, -6, 14, 18, 0, 9)
  path(pieces, REBIRTH_STATUE.x - 5, REBIRTH_STATUE.x + 5, REBIRTH_STATUE.z - 5, REBIRTH_STATUE.z + 5, 1, 10)
  path(pieces, 8, 12, 32, 37, 0, 11)

  const parts = pieces.map(({ geo, tint }) => {
    const n = geo.getAttribute('position').count
    geo.setAttribute('color', new Float32BufferAttribute(new Float32Array(n * 3).fill(tint), 3))
    return geo
  })
  const merged = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  if (!merged) throw new Error('paving merge failed')
  merged.computeBoundingSphere()
  return merged
}
