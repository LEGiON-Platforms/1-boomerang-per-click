import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import {
  CORRIDOR,
  formatNumber,
  highestUnlockedStage,
  padWins,
  PAD_OFFSET,
  PAD_SIZE,
  PAD_X,
  padZ,
  REWARD_ROOM,
  STAGE_COUNT,
  STAGE_LENGTH,
  stageDef,
  stageStartZ,
  WALL_HEIGHT,
  WALL_THICKNESS,
  wallZ,
  WALLS_PER_STAGE,
  winsMultiplier,
} from '@game/shared'
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  type BufferGeometry,
  Color,
  DoubleSide,
  type InstancedMesh,
  Matrix4,
  type Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  type Texture,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { serverNow, useGame } from '../../state/gameStore'
import { useQuality } from '../../state/qualityStore'
import { PropBuilder } from '../builder'
import { now, wallFx } from '../runtime'
import { createStudTexture, createWorldBoxGeometry } from '../textures'
import { createWallTexture, getCrackTexture } from './wallTextures'

const MAX_WINDOW = 3
const PAD_COLOR = '#2bff6a'
const HIDDEN = new Matrix4().makeScale(0, 0, 0)
const _o = new Object3D()

/** Sets `_o` to an unrotated, unscaled transform at (x, y, z) and updates its matrix. */
function placeAt(x: number, y: number, z: number, rotY = 0): Matrix4 {
  _o.position.set(x, y, z)
  _o.rotation.set(0, rotY, 0)
  _o.scale.setScalar(1)
  _o.updateMatrix()
  return _o.matrix
}
const _c = new Color()

/** Length of a stage's narrow corridor, then of its wider reward room. */
const NARROW_LEN = REWARD_ROOM.startOffset
const ROOM_LEN = STAGE_LENGTH - REWARD_ROOM.startOffset
/** Corridor segments: [half width, start z, length]. */
const SEGMENTS: [number, number, number][] = [
  [CORRIDOR.halfWidth, 0, NARROW_LEN],
  [REWARD_ROOM.halfWidth, -NARROW_LEN, ROOM_LEN],
]
/** Cliff tiers either side of a segment: [inner offset, outer offset, height]. */
const TIERS: [number, number, number][] = [
  [0, 4, 12],
  [4, 12, 20],
]
const GATE_HEIGHT = 12

function boxes(top: boolean, tile: number): BufferGeometry {
  const parts: BufferGeometry[] = []
  for (const side of [-1, 1]) {
    for (const [half, z0, len] of SEGMENTS) {
      for (const [a, b, h] of TIERS) {
        const w = b - a
        const g = createWorldBoxGeometry(w, top ? 0.5 : h, len, tile)
        g.translate(side * (half + a + w / 2), top ? h + 0.25 : h / 2, z0 - len / 2)
        parts.push(g)
      }
    }
    if (!top) {
      // The reward room's end wall either side of the gate, outside the gate posts.
      const inner = CORRIDOR.halfWidth + 0.8
      const w = REWARD_ROOM.halfWidth - inner
      const g = createWorldBoxGeometry(w, GATE_HEIGHT, 1.4, tile)
      g.translate(side * (inner + w / 2), GATE_HEIGHT / 2, -STAGE_LENGTH + 0.7)
      parts.push(g)
    }
  }
  const merged = mergeGeometries(parts, false)!
  for (const p of parts) p.dispose()
  return merged
}

/** Corridor floor: the narrow run plus the wider reward room. */
function floorGeometry(): BufferGeometry {
  const parts = SEGMENTS.map(([half, z0, len]) => {
    const g = createWorldBoxGeometry(half * 2, 1, len, 2)
    g.translate(0, -0.5, z0 - len / 2)
    return g
  })
  const merged = mergeGeometries(parts, false)!
  for (const p of parts) p.dispose()
  return merged
}

/** Per-stage decoration in one vertex-coloured geometry: gate frame, pad rim, trees. */
function buildDecor(): BufferGeometry {
  const b = new PropBuilder()
  const gate = -STAGE_LENGTH
  for (const side of [-1, 1]) b.block(side * 8.3, 0, gate, 1, 12, 1.4, '#f1f1f6')
  b.block(0, 12, gate, 17.6, 1.4, 1.4, '#ff5c8a')
  b.block(PAD_X, 0, -PAD_OFFSET, PAD_SIZE.w + 1, 0.2, PAD_SIZE.d + 1, '#2a2d3a')
  for (let z = -8; z > -STAGE_LENGTH; z -= 16) {
    // Trees stand on the outer cliff tier, which steps out around the reward room.
    const half = (zz: number) => (zz < -NARROW_LEN ? REWARD_ROOM.halfWidth : CORRIDOR.halfWidth) + 8
    b.tree(-half(z), 20, z, 1.1)
    b.tree(half(z - 8), 20, z - 8, 1.1)
  }
  return b.build()
}

/** Which stages are drawn: the one the player is in, plus neighbours per preset. */
function useStageWindow(): number[] {
  const here = useGame((s) => s.stageHere)
  const window = useQuality((s) => s.settings.stageWindow)
  return useMemo(() => {
    const center = Math.max(1, here)
    const out: number[] = []
    for (let s = center - window; s <= center + Math.max(1, window); s += 1) {
      if (s >= 1 && s <= STAGE_COUNT) out.push(s)
    }
    return out.slice(0, MAX_WINDOW + 1)
  }, [here, window])
}

/** Floor, cliffs, grass and decor: one instance per visible stage of each. */
function CorridorShell({ stages }: { stages: number[] }) {
  const texSize = useQuality((s) => s.settings.textureSize)
  const refs = [useRef<InstancedMesh>(null), useRef<InstancedMesh>(null), useRef<InstancedMesh>(null), useRef<InstancedMesh>(null)]

  const textures = useMemo(
    () => ({
      floor: createStudTexture({ base: '#cf8a5c', alt: '#c27b4d', size: texSize }) as Texture,
      grass: createStudTexture({ base: '#4ee628', alt: '#45d923', size: texSize }) as Texture,
      brick: createStudTexture({ base: '#be5a3c', alt: '#ad5135', studsPerCell: 4, size: texSize }) as Texture,
    }),
    [texSize],
  )
  const geometries = useMemo(() => {
    return { floor: floorGeometry(), cliffs: boxes(false, 4), grass: boxes(true, 2), decor: buildDecor() }
  }, [])
  const materials = useMemo(
    () => ({
      floor: new MeshLambertMaterial({ map: textures.floor }),
      cliffs: new MeshLambertMaterial({ map: textures.brick }),
      grass: new MeshLambertMaterial({ map: textures.grass }),
      decor: new MeshLambertMaterial({ vertexColors: true }),
    }),
    [textures],
  )

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

  // Layout effect: positions are set before the first frame (identity = the lobby gate).
  useLayoutEffect(() => {
    for (const ref of refs) {
      const mesh = ref.current
      if (!mesh) continue
      for (let i = 0; i <= MAX_WINDOW; i += 1) {
        const s = stages[i]
        if (s === undefined) {
          mesh.setMatrixAt(i, HIDDEN)
          continue
        }
        mesh.setMatrixAt(i, placeAt(0, 0, stageStartZ(s)))
      }
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
    // refs are stable; only the window matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages])

  const n = MAX_WINDOW + 1
  return (
    <>
      <instancedMesh ref={refs[0]} args={[geometries.floor, materials.floor, n]} receiveShadow />
      <instancedMesh ref={refs[1]} args={[geometries.cliffs, materials.cliffs, n]} receiveShadow />
      <instancedMesh ref={refs[2]} args={[geometries.grass, materials.grass, n]} />
      <instancedMesh ref={refs[3]} args={[geometries.decor, materials.decor, n]} castShadow receiveShadow />
    </>
  )
}

/** The 10 walls of one stage, in one instanced draw call with the stage's material. */
const StageWalls = memo(function StageWalls({ stage }: { stage: number }) {
  const ref = useRef<InstancedMesh>(null)
  const run = useGame((s) => s.run)
  const unlocked = useGame((s) => (s.data ? highestUnlockedStage(s.data) : 1))
  const texSize = useQuality((s) => s.settings.textureSize)
  const def = stageDef(stage)

  // Texture repeat in world units: small studs and bricks, big slabs for the rest.
  const tile = def.pattern === 'studs' ? 3 : def.pattern === 'brick' ? 4 : 8
  const geometry = useMemo(() => createWorldBoxGeometry(CORRIDOR.halfWidth * 2, WALL_HEIGHT, WALL_THICKNESS, tile), [tile])
  const texture = useMemo(() => createWallTexture(def, texSize), [def, texSize])
  const material = useMemo(() => {
    const m = new MeshLambertMaterial({ map: texture })
    if (def.glow > 0) {
      m.emissive.set(def.accent)
      m.emissiveMap = texture
      m.emissiveIntensity = def.glow * 0.6
    }
    return m
  }, [texture, def])

  useEffect(
    () => () => {
      geometry.dispose()
    },
    [geometry],
  )
  useEffect(
    () => () => {
      texture.dispose()
      material.dispose()
    },
    [texture, material],
  )

  const broken = stage < run.stage ? WALLS_PER_STAGE : stage === run.stage ? run.wallsBroken : 0
  const locked = stage > unlocked

  // Wall visibility only changes with the run, so matrices are written here, not per frame.
  // Layout effect: positions are set before the first frame (identity = the lobby gate).
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    for (let w = 0; w < WALLS_PER_STAGE; w += 1) {
      if (w < broken) {
        mesh.setMatrixAt(w, HIDDEN)
        continue
      }
      mesh.setMatrixAt(w, placeAt(0, WALL_HEIGHT / 2, wallZ(stage, w + 1)))
      mesh.setColorAt(w, _c.set(locked ? '#555566' : '#ffffff'))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [broken, locked, stage])

  // A short shake on the active wall when it's hit.
  const shaking = useRef(false)
  useFrame(() => {
    const mesh = ref.current
    if (!mesh || stage !== run.stage || broken >= WALLS_PER_STAGE) return
    const since = now() - wallFx.hitAt
    if (since < 0.16 || shaking.current) {
      shaking.current = since < 0.16
      const x = shaking.current ? Math.sin(since * 120) * 0.12 : 0
      mesh.setMatrixAt(broken, placeAt(x, WALL_HEIGHT / 2, wallZ(stage, broken + 1)))
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return <instancedMesh ref={ref} args={[geometry, material, WALLS_PER_STAGE]} castShadow receiveShadow frustumCulled={false} />
})

/** Cracks spreading over the whole active wall as its HP drops. */
function CrackOverlay() {
  const ref = useRef<Mesh>(null)
  const run = useGame((s) => s.run)
  const geometry = useMemo(() => new PlaneGeometry(CORRIDOR.halfWidth * 2 - 0.2, WALL_HEIGHT - 0.2), [])
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        map: getCrackTexture(),
        // Cracks show where their stored threshold is under the damage (see getCrackTexture).
        alphaTest: 0.99,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    [],
  )
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )
  if (run.wallsBroken >= WALLS_PER_STAGE || run.wallMax <= 0) return null
  const damage = 1 - run.wallHp / run.wallMax
  if (damage <= 0.02) return null
  // Stays above 0 so three.js never has to recompile the alphaTest variant.
  material.alphaTest = Math.min(0.99, Math.max(0.03, 1 - damage))
  return (
    <mesh
      ref={ref}
      geometry={geometry}
      material={material}
      position={[0, WALL_HEIGHT / 2, wallZ(run.stage, run.wallsBroken + 1) + WALL_THICKNESS / 2 + 0.01]}
    />
  )
}

/** Glowing win pads and the translucent barriers on closed gates. */
function PadsAndGates({ stages }: { stages: number[] }) {
  const padRef = useRef<InstancedMesh>(null)
  const gateRef = useRef<InstancedMesh>(null)
  const runStage = useGame((s) => s.run.stage)
  const padClaimed = useGame((s) => s.run.padClaimed)
  const padGeo = useMemo(() => {
    const g = createWorldBoxGeometry(PAD_SIZE.w, 0.3, PAD_SIZE.d, 2)
    return g
  }, [])
  const gateGeo = useMemo(() => new PlaneGeometry(CORRIDOR.halfWidth * 2, 12), [])
  const padMat = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), [])
  const gateMat = useMemo(
    // forceSinglePass: three.js would otherwise draw transparent DoubleSide twice a
    // frame by flipping material.side, recompiling-lookup its program each time.
    () => new MeshBasicMaterial({ color: '#7fe8ff', transparent: true, opacity: 0.22, depthWrite: false, side: DoubleSide, forceSinglePass: true }),
    [],
  )
  useEffect(
    () => () => {
      padGeo.dispose()
      gateGeo.dispose()
      padMat.dispose()
      gateMat.dispose()
    },
    [padGeo, gateGeo, padMat, gateMat],
  )

  // Layout effect: positions are set before the first frame (identity = the lobby gate).
  useLayoutEffect(() => {
    const pads = padRef.current
    const gates = gateRef.current
    if (!pads || !gates) return
    for (let i = 0; i <= MAX_WINDOW; i += 1) {
      const s = stages[i]
      if (s === undefined) {
        pads.setMatrixAt(i, HIDDEN)
        gates.setMatrixAt(i, HIDDEN)
        continue
      }
      pads.setMatrixAt(i, placeAt(PAD_X, 0.15, padZ(s)))
      // Neon green like the original; a claimed pad dims until the walls respawn.
      _c.set(PAD_COLOR)
      if (s === runStage && padClaimed) _c.multiplyScalar(0.35)
      pads.setColorAt(i, _c)
      // Gates at or past the active stage stay shut.
      if (s >= runStage) {
        gates.setMatrixAt(i, placeAt(0, 6, stageStartZ(s) - STAGE_LENGTH))
      } else gates.setMatrixAt(i, HIDDEN)
    }
    pads.instanceMatrix.needsUpdate = true
    if (pads.instanceColor) pads.instanceColor.needsUpdate = true
    gates.instanceMatrix.needsUpdate = true
    pads.computeBoundingSphere()
    gates.computeBoundingSphere()
  }, [stages, runStage, padClaimed])

  return (
    <>
      <instancedMesh ref={padRef} args={[padGeo, padMat, MAX_WINDOW + 1]} />
      <instancedMesh ref={gateRef} args={[gateGeo, gateMat, MAX_WINDOW + 1]} renderOrder={3} />
    </>
  )
}

/** A gold trophy cup (one vertex-coloured geometry), about 2 units tall. */
function buildTrophy(): BufferGeometry {
  const b = new PropBuilder()
  b.block(0, 0, 0, 1.3, 0.3, 1.3, '#7a4b1c') // plinth
  b.block(0, 0.3, 0, 0.9, 0.18, 0.9, '#ffc21a') // base plate
  b.cylinder(0, 0.48, 0, 0.14, 0.55, '#e8a400', 10) // stem
  b.cylinder(0, 1.03, 0, 0.32, 0.14, '#ffc21a', 14) // knob
  b.cylinder(0, 1.17, 0, 0.36, 0.9, '#ffc21a', 18, 0.78) // cup, flaring out
  b.cylinder(0, 2.07, 0, 0.8, 0.1, '#fff0a0', 18) // rim
  for (const sx of [-1, 1]) {
    b.box(sx * 0.92, 1.75, 0, 0.16, 0.6, 0.16, '#ffc21a') // handles
    b.box(sx * 0.8, 2.0, 0, 0.32, 0.14, 0.16, '#ffc21a')
    b.box(sx * 0.72, 1.5, 0, 0.28, 0.14, 0.16, '#ffc21a')
  }
  return b.build()
}

/** A gold trophy spinning over each visible win pad (gone once the run's pad is claimed). */
function PadTrophies({ stages }: { stages: number[] }) {
  const ref = useRef<InstancedMesh>(null)
  const runStage = useGame((s) => s.run.stage)
  const padClaimed = useGame((s) => s.run.padClaimed)
  const geometry = useMemo(buildTrophy, [])
  const material = useMemo(() => new MeshLambertMaterial({ vertexColors: true, emissive: new Color('#4a3000') }), [])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )
  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const t = now()
    for (let i = 0; i <= MAX_WINDOW; i += 1) {
      const s = stages[i]
      if (s === undefined || (s === runStage && padClaimed)) {
        mesh.setMatrixAt(i, HIDDEN)
        continue
      }
      mesh.setMatrixAt(i, placeAt(PAD_X, 3 + Math.sin(t * 2 + s) * 0.25, padZ(s), t * 2.2))
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geometry, material, MAX_WINDOW + 1]} castShadow frustumCulled={false} />
}

/** DOM labels for the active run: the current wall's HP and the win pad's payout. */
function RunLabels({ stages }: { stages: number[] }) {
  const run = useGame((s) => s.run)
  const data = useGame((s) => s.data)
  if (!stages.includes(run.stage) || !data) return null
  const def = stageDef(run.stage)
  const wallActive = run.wallsBroken < WALLS_PER_STAGE
  const wins = Math.floor(padWins(run.stage) * winsMultiplier(data, serverNow()))
  return (
    <>
      {wallActive && (
        <Html
          position={[0, WALL_HEIGHT * 0.36, wallZ(run.stage, run.wallsBroken + 1) + WALL_THICKNESS / 2 + 0.1]}
          // In-world (CSS 3D) like a sign on the wall: it scales with distance and
          // keeps the same size relative to the wall on every screen.
          transform
          distanceFactor={10}
          center
          zIndexRange={[4, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="wall-label">
            <div className="txt-outline text-[38px]">STAGE {run.stage}</div>
            <div className="txt-outline text-[24px]" style={{ color: '#ffd21f' }}>
              {def.material.toUpperCase()}
            </div>
            <div className="wall-hp">
              <div className="fill" style={{ width: `${Math.max(6, (run.wallHp / run.wallMax) * 100)}%` }} />
              <div className="text txt-outline">
                {formatNumber(run.wallHp)}/{formatNumber(run.wallMax)}
              </div>
            </div>
          </div>
        </Html>
      )}
      {/* DOM labels aren't occluded, so the pad's only shows once the way is clear. */}
      {!wallActive && (
        <Html position={[PAD_X, 6.4, padZ(run.stage)]} transform sprite distanceFactor={10} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
          <div className="flex flex-col items-center whitespace-nowrap">
            <div className="txt-outline text-[40px]" style={{ color: run.padClaimed ? '#9aa3b5' : '#5dff7a' }}>
              +{formatNumber(wins)} WINS
            </div>
            {!run.padClaimed && (
              <div className="txt-outline text-[20px]" style={{ color: '#ffe14a' }}>
                Step on the pad!
              </div>
            )}
          </div>
        </Html>
      )}
    </>
  )
}

export default function StageCorridor() {
  const stages = useStageWindow()
  return (
    <group>
      <CorridorShell stages={stages} />
      {stages.map((s) => (
        <StageWalls key={s} stage={s} />
      ))}
      <CrackOverlay />
      <PadsAndGates stages={stages} />
      <PadTrophies stages={stages} />
      <RunLabels stages={stages} />
    </group>
  )
}
