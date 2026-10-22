import { useFrame } from '@react-three/fiber'
import {
  BOOMERANG_STEPS,
  EGG_SPOTS,
  EGGS,
  INVITE_BOARD,
  LEADERBOARD_SPOTS,
  LIKE_BOARD,
  LOBBY,
  PEDESTAL_SPOTS,
  REBIRTH_STATUE,
  SPAWN,
  STAGES_PORTAL,
  TRAILS_STALL,
  TRAINING_DECK,
  TRAINING_PAD_SPOTS,
  TRAINING_PADS,
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

  // Spawn plaza disc and the paths leading off it.
  b.cylinder(SPAWN.x, 0, SPAWN.z, 7.5, 0.06, '#b9bcc8', 28)
  b.cylinder(SPAWN.x, 0, SPAWN.z, 5.5, 0.08, '#a6a9b6', 28)

  // Corridor gate arch.
  b.block(-9, 0, 0, 2, 12, 2, '#e9e9ef').block(9, 0, 0, 2, 12, 2, '#e9e9ef')
  b.block(0, 12, 0, 20, 1.6, 2, '#ff5c8a')

  // Training deck with plank stripes, and the dummies' sign posts.
  const deckW = TRAINING_DECK.maxX - TRAINING_DECK.minX
  const deckD = TRAINING_DECK.maxZ - TRAINING_DECK.minZ
  const deckCx = (TRAINING_DECK.minX + TRAINING_DECK.maxX) / 2
  const deckCz = (TRAINING_DECK.minZ + TRAINING_DECK.maxZ) / 2
  b.block(deckCx, 0, deckCz, deckW, 1.2, deckD, '#8a5530')
  for (let z = TRAINING_DECK.minZ + 1; z < TRAINING_DECK.maxZ; z += 2) {
    b.block(deckCx, 1.2, z, deckW, 0.06, 0.12, '#6e4224')
  }
  b.block(TRAINING_DECK.maxX - 0.3, 0, deckCz, 0.6, 1.5, deckD, '#6e4224')

  // Boomerang display steps (east) and pedestals.
  const stepsCz = (BOOMERANG_STEPS.minZ + BOOMERANG_STEPS.maxZ) / 2
  const stepsD = BOOMERANG_STEPS.maxZ - BOOMERANG_STEPS.minZ
  for (let i = 0; i < 4; i += 1) {
    const x0 = BOOMERANG_STEPS.minX + i * 2.5
    b.block((x0 + LOBBY.maxX) / 2, 0, stepsCz, LOBBY.maxX - x0, 1 + i * 1.2, stepsD, i % 2 ? '#b0462c' : '#c4553b')
  }
  for (const p of PEDESTAL_SPOTS) {
    b.cylinder(p.x, 0, p.z, 1.1, 0.5, '#7a1f1f', 18)
    b.cylinder(p.x, 0.5, p.z, 0.95, 0.5, '#e8323c', 18)
  }

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

  // Stages portal: pink/white brick arch.
  const { x: px, z: pz } = STAGES_PORTAL
  for (let y = 0; y < 8; y += 1) {
    const col = y % 2 ? '#ffffff' : '#ff7ab8'
    b.block(px - 3.6, y, pz, 1.4, 1, 1.4, col).block(px + 3.6, y, pz, 1.4, 1, 1.4, y % 2 ? '#ff7ab8' : '#ffffff')
  }
  for (let i = 0; i < 6; i += 1) b.block(px - 3.6 + i * 1.44, 8, pz, 1.44, 1, 1.4, i % 2 ? '#ffffff' : '#ff7ab8')

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
    [36, 58],
    [-36, 60],
    [10, 30],
  ].forEach(([x, z], i) => b.pumpkin(x, 0, z, 0.8 + (i % 3) * 0.15))
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
  // Portal surface.
  b.box(STAGES_PORTAL.x, 4, STAGES_PORTAL.z, 5.8, 8, 0.2, '#ff9fd0')
  return b.build()
}

export function Lobby() {
  const groupRef = useRef<Group>(null)
  const texSize = useQuality((s) => s.settings.textureSize)

  const textures = useMemo(() => {
    const t = {
      floor: createStudTexture({ base: '#d7d9e2', alt: '#cdd0da', size: texSize }) as Texture,
      grass: createStudTexture({ base: '#5cee30', alt: '#52de2b', size: texSize }) as Texture,
      brick: createStudTexture({ base: '#c8743e', alt: '#b8662f', studsPerCell: 4, size: texSize }) as Texture,
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
      cliffs: mergeWorldBoxes(boxes, BRICK_TILE, false),
      cliffTops: mergeWorldBoxes(boxes, STUD_TILE, true),
      props: buildProps(),
      glow: buildGlow(),
    }
  }, [])

  const materials = useMemo(
    () => ({
      floor: new MeshLambertMaterial({ map: textures.floor }),
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
      <mesh geometry={geometries.floor} material={materials.floor} receiveShadow />
      <mesh geometry={geometries.cliffs} material={materials.brick} receiveShadow />
      <mesh geometry={geometries.cliffTops} material={materials.grass} />
      <mesh geometry={geometries.props} material={materials.props} castShadow receiveShadow />
      <mesh geometry={geometries.glow} material={materials.glow} />
      <Dummies />
      <EggBlocks />
      <LobbySigns />
      <Leaderboards />
    </group>
  )
}

export default Lobby
