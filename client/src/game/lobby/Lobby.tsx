import { useFrame } from '@react-three/fiber'
import {
  BOOMERANG_SPOTS,
  BOOMERANG_STAGE,
  EGG_SPOTS,
  EGGS,
  INVITE_BOARD,
  LEADERBOARD_SPOTS,
  LIKE_BOARD,
  LOBBY,
  REBIRTH_STATUE,
  SPAWN,
  TRAILS_STALL,
  TRAINING_DECK,
  TRAINING_PAD_SPOTS,
  TRAINING_PADS,
  VIP_DISPLAY,
} from '@game/shared'
import { useEffect, useMemo, useRef } from 'react'
import { BufferGeometry, type Group, MeshBasicMaterial, MeshLambertMaterial, type Texture } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { useQuality } from '../../state/qualityStore'
import { PropBuilder } from '../builder'
import { localPlayer } from '../runtime'
import { createStudTexture, createWorldBoxGeometry, createWorldPlaneGeometry } from '../textures'
import { Dummies } from './Dummies'
import { EggBlocks } from './EggBlocks'
import { Leaderboards } from './Leaderboards'
import { LobbySigns } from './LobbySigns'
import { buildPaving } from './paving'
import { NextBoomerangGlow } from './NextBoomerangGlow'

/** Cliff tiers around the lobby's west, east and south: [inner offset, outer offset, height]. */
const TIERS: [number, number, number][] = [
  [0, 6, 6],
  [6, 14, 12],
]

const STUD_TILE = 2
const BRICK_TILE = 4

/** Boxes (cx, cz, sx, sz, h) for the cliffs ringing the lobby, leaving the gate open. */
function cliffBoxes(): [number, number, number, number, number][] {
  const out: [number, number, number, number, number][] = []
  const { minX, maxX, minZ, maxZ } = LOBBY
  const extra = 16
  for (const [a, b, h] of TIERS) {
    const t = b - a
    // West / east.
    out.push([minX - a - t / 2, (minZ + maxZ) / 2, t, maxZ - minZ + extra * 2, h])
    out.push([maxX + a + t / 2, (minZ + maxZ) / 2, t, maxZ - minZ + extra * 2, h])
    // South (behind the leaderboards).
    out.push([0, maxZ + a + t / 2, maxX - minX + extra * 2, t, h])
  }
  // North, either side of the gate. The corridor's own cliffs (x 8..20) begin at
  // z = -4, so these stop where they start instead of overlapping them.
  // Stop at the lobby edge, where the west/east cliffs (which run past z = 0) take over.
  const outer = maxX
  const ledge = (x0: number) => [x0 + (outer - x0) / 2, -2, outer - x0, 4, 6] as [number, number, number, number, number]
  const back = (x0: number) => [x0 + (outer - x0) / 2, -9, outer - x0, 10, 12] as [number, number, number, number, number]
  for (const side of [-1, 1]) {
    const l = ledge(8)
    const b = back(20)
    out.push([side * l[0], l[1], l[2], l[3], l[4]])
    out.push([side * b[0], b[1], b[2], b[3], b[4]])
  }
  return out
}

function mergeWorldBoxes(boxes: [number, number, number, number, number][], tile: number, topOnly: boolean): BufferGeometry {
  const parts = boxes.map(([cx, cz, sx, sz, h]) => {
    const g = topOnly ? createWorldBoxGeometry(sx, 0.5, sz, tile) : createWorldBoxGeometry(sx, h, sz, tile)
    g.translate(cx, topOnly ? h + 0.25 : h / 2, cz)
    return g
  })
  const merged = mergeGeometries(parts, false)!
  for (const p of parts) p.dispose()
  return merged
}

function buildProps(): BufferGeometry {
  const b = new PropBuilder()

  // Corridor gate arch.
  // Pillars stand 0.1 proud of the cliff faces at x = ±8 (flush faces z-fight).
  b.block(-9, 0, 0, 2.2, 12, 2.2, '#e9e9ef').block(9, 0, 0, 2.2, 12, 2.2, '#e9e9ef')
  b.block(0, 12, 0, 20, 1.6, 2, '#ff5c8a')

  // Training deck with plank stripes, and the dummies' sign posts.
  const deckW = TRAINING_DECK.maxX - TRAINING_DECK.minX
  const deckD = TRAINING_DECK.maxZ - TRAINING_DECK.minZ
  const deckCx = (TRAINING_DECK.minX + TRAINING_DECK.maxX) / 2
  const deckCz = (TRAINING_DECK.minZ + TRAINING_DECK.maxZ) / 2
  b.block(deckCx, 0, deckCz, deckW, 1.2, deckD, '#8a5530')
  for (let z = TRAINING_DECK.minZ + 1; z < TRAINING_DECK.maxZ; z += 2) {
    b.block(deckCx, 1.2, z, deckW - 0.04, 0.06, 0.12, '#6e4224')
  }
  b.block(TRAINING_DECK.maxX - 0.28, 0, deckCz, 0.6, 1.5, deckD + 0.04, '#6e4224') // rail, just proud of the deck face

  // Boomerang Stage (east): two tiers with a light trim along their front edges,
  // a red buy pad under every display and a gold podium for the VIP boomerang.
  const S = BOOMERANG_STAGE
  const depth = S.maxZ - S.minZ
  const cz = (S.minZ + S.maxZ) / 2
  b.block((S.minX + S.backX) / 2, 0, cz, S.backX - S.minX, S.frontHeight, depth, '#c4553b')
  b.block((S.backX + S.maxX) / 2, 0, cz, S.maxX - S.backX, S.backHeight, depth, '#b0462c')
  // Trims stand a little proud of the faces they sit on, so they never z-fight.
  b.block(S.minX + 0.1, S.frontHeight - 0.12, cz, 0.3, 0.15, depth + 0.04, '#f0b08f')
  b.block(S.backX + 0.1, S.backHeight - 0.12, cz, 0.3, 0.15, depth + 0.04, '#f0b08f')
  for (const p of BOOMERANG_SPOTS) {
    b.cylinder(p.x, p.y, p.z, S.padRadius, 0.1, '#5a1418', 20)
    b.cylinder(p.x, p.y + 0.1, p.z, S.padRadius - 0.22, 0.06, '#ff2f45', 20)
  }
  b.cylinder(VIP_DISPLAY.x, VIP_DISPLAY.y, VIP_DISPLAY.z, 1.8, 0.35, '#8a5a00', 20)
  b.cylinder(VIP_DISPLAY.x, VIP_DISPLAY.y + 0.35, VIP_DISPLAY.z, 1.5, 0.2, '#ffc21a', 20)

  // Trails stall: counter, back wall, striped awning, poles.
  const { x: tx, z: tz } = TRAILS_STALL
  b.block(tx, 0, tz, 6.4, 1.3, 2.4, '#a8693a')
  b.block(tx, 1.3, tz, 6.6, 0.15, 2.6, '#7a4b2a')
  b.block(tx, 0, tz - 1.4, 6.4, 4.2, 0.4, '#c98a4b')
  for (const sx of [-3, 3]) b.block(tx + sx, 0, tz + 1.1, 0.25, 4.4, 0.25, '#e9e9ef')
  for (let i = 0; i < 8; i += 1) {
    b.box(tx - 3.15 + i * 0.9, 4.5, tz + 0.2, 0.9, 0.35, 3.4, i % 2 ? '#ffffff' : '#2f8cff')
  }
  b.block(tx + 1.8, 1.45, tz - 0.6, 0.8, 1.6, 0.6, '#d9a066') // a little trainer behind the counter

  // Rebirth statue pedestal.
  const { x: rx, z: rz } = REBIRTH_STATUE
  b.cylinder(rx, 0, rz, 2, 0.6, '#5b2a8f', 20)
  b.cylinder(rx, 0.6, rz, 1.5, 1.4, '#7b3dff', 20)
  b.cylinder(rx, 2, rz, 1.8, 0.3, '#5b2a8f', 20)

  // Egg pedestals.
  EGG_SPOTS.forEach((e, i) => {
    if (EGGS[i].id === 'event') return
    b.cylinder(e.x, 0, e.z, 1.6, 0.5, '#41444f', 20)
    b.cylinder(e.x, 0.5, e.z, 1.35, 0.3, '#6b6f7d', 20)
  })
  // Halloween egg: a witch-hat pumpkin stack.
  const ev = EGG_SPOTS[EGGS.findIndex((e) => e.id === 'event')]
  b.cylinder(ev.x, 0, ev.z, 2.2, 0.5, '#4a1f6e', 20)
  b.cylinder(ev.x, 0.5, ev.z, 1.8, 1.6, '#7b2fbf', 12)
  b.cylinder(ev.x, 2.1, ev.z, 1.5, 0.5, '#ff8a1f', 12)
  b.cylinder(ev.x, 2.6, ev.z, 2.3, 0.25, '#2b1a3a', 16)
  b.cone(ev.x, 2.85, ev.z, 1.3, 2.6, '#2b1a3a', 10)
  b.block(ev.x, 2.75, ev.z, 2.4, 0.25, 0.3, '#ffcc33')

  // Leaderboard frames.
  for (const l of LEADERBOARD_SPOTS) {
    b.block(l.x, 0, l.z + 0.5, 13, 12.5, 0.8, '#5a3a24')
    b.block(l.x, 12.5, l.z + 0.5, 13.6, 0.8, 1.2, '#7a4b2a')
  }
  // Like-goal board and invite sign posts.
  b.block(LIKE_BOARD.x, 0, LIKE_BOARD.z + 0.4, 6.6, 5, 0.5, '#5a3a24')
  b.block(INVITE_BOARD.x, 0, INVITE_BOARD.z, 0.4, 2.2, 0.4, '#7a4b2a')

  // Decorative pumpkins and trees on the cliff tops.
  ;[
    [-6, 14],
    [6, 14],
    [-22, 46],
    [24, 52],
    [-8, 52],
    [36, 63],
    [-36, 60],
    [10, 30],
  ].forEach(([x, z], i) => b.pumpkin(x, 0, z, 0.8 + (i % 3) * 0.15, Math.atan2(SPAWN.x - x, SPAWN.z - z))) // grinning at spawn
  for (let z = -2; z <= 72; z += 9) {
    b.tree(LOBBY.minX - 10, 12, z, 1.1)
    b.tree(LOBBY.maxX + 10, 12, z + 4, 1.1)
  }
  for (let x = -40; x <= 40; x += 10) b.tree(x, 12, LOBBY.maxZ + 10, 1.2)

  return b.build()
}

function buildGlow(): BufferGeometry {
  const b = new PropBuilder()
  TRAINING_PAD_SPOTS.forEach((s, i) => {
    b.block(s.pad.x, 0.02, s.pad.z, 4.2, 0.12, 4.2, TRAINING_PADS[i].color)
  })
  return b.build()
}

export function Lobby() {
  const groupRef = useRef<Group>(null)
  const texSize = useQuality((s) => s.settings.textureSize)

  const textures = useMemo(() => {
    const t = {
      // Colours from the original: lavender-grey paving, lego-green grass, terracotta cliffs.
      floor: createStudTexture({ base: '#dcdce8', alt: '#d1d1df', size: texSize }) as Texture,
      grass: createStudTexture({ base: '#4ee628', alt: '#45d923', size: texSize }) as Texture,
      brick: createStudTexture({ base: '#c8643c', alt: '#b85a36', studsPerCell: 4, size: texSize }) as Texture,
    }
    return t
  }, [texSize])

  const geometries = useMemo(() => {
    const { minX, maxX, maxZ } = LOBBY
    // Starts at z = -4 so it meets stage 1's floor with no gap under the gate.
    const floorMinZ = -4
    const floor = createWorldBoxGeometry(maxX - minX, 1, maxZ - floorMinZ, STUD_TILE)
    floor.translate((minX + maxX) / 2, -0.5, (floorMinZ + maxZ) / 2)
    const field = createWorldPlaneGeometry(700, 700, STUD_TILE)
    field.rotateX(-Math.PI / 2)
    field.translate(0, -0.3, 0)
    const boxes = cliffBoxes()
    return {
      floor,
      field,
      paving: buildPaving(),
      cliffs: mergeWorldBoxes(boxes, BRICK_TILE, false),
      cliffTops: mergeWorldBoxes(boxes, STUD_TILE, true),
      props: buildProps(),
      glow: buildGlow(),
    }
  }, [])

  const materials = useMemo(
    () => ({
      paving: new MeshLambertMaterial({ map: textures.floor, vertexColors: true }),
      grass: new MeshLambertMaterial({ map: textures.grass }),
      brick: new MeshLambertMaterial({ map: textures.brick }),
      props: new MeshLambertMaterial({ vertexColors: true }),
      glow: new MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    }),
    [textures],
  )

  // Dispose GPU resources when the lobby unmounts or textures are rebuilt.
  useEffect(
    () => () => {
      for (const t of Object.values(textures)) t.dispose()
      for (const m of Object.values(materials)) m.dispose()
    },
    [textures, materials],
  )
  useEffect(
    () => () => {
      for (const g of Object.values(geometries)) g.dispose()
    },
    [geometries],
  )

  // Distance culling: nothing here is visible from deep in the corridor.
  useFrame(() => {
    if (groupRef.current) groupRef.current.visible = localPlayer.pos.z > -160
  })

  return (
    <group ref={groupRef}>
      <mesh geometry={geometries.field} material={materials.grass} receiveShadow />
      {/* The lobby ground is grass; paving (plaza, paths) is laid over it. */}
      <mesh geometry={geometries.floor} material={materials.grass} receiveShadow />
      <mesh geometry={geometries.paving} material={materials.paving} receiveShadow />
      <mesh geometry={geometries.cliffs} material={materials.brick} receiveShadow />
      <mesh geometry={geometries.cliffTops} material={materials.grass} />
      <mesh geometry={geometries.props} material={materials.props} castShadow receiveShadow />
      <mesh geometry={geometries.glow} material={materials.glow} />
      <Dummies />
      <EggBlocks />
      <LobbySigns />
      <NextBoomerangGlow />
      <Leaderboards />
    </group>
  )
}

export default Lobby
