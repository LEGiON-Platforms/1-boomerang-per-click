import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import {
  CORRIDOR,
  formatNumber,
  highestUnlockedStage,
  padWins,
  PAD_OFFSET,
  PAD_SIZE,
  padZ,
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
import { memo, useEffect, useMemo, useRef } from 'react'
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
const HIDDEN = new Matrix4().makeScale(0, 0, 0)
const _o = new Object3D()
const _c = new Color()

/** Cliff tiers either side of the corridor: [inner x, outer x, height]. */
const TIERS: [number, number, number][] = [
  [CORRIDOR.halfWidth, CORRIDOR.halfWidth + 4, 12],
  [CORRIDOR.halfWidth + 4, CORRIDOR.halfWidth + 12, 20],
]

function boxes(top: boolean, tile: number): BufferGeometry {
  const parts: BufferGeometry[] = []
  for (const side of [-1, 1]) {
    for (const [a, b, h] of TIERS) {
      const w = b - a
      const g = createWorldBoxGeometry(w, top ? 0.5 : h, STAGE_LENGTH, tile)
      g.translate(side * (a + w / 2), top ? h + 0.25 : h / 2, -STAGE_LENGTH / 2)
      parts.push(g)
    }
  }
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
  b.block(0, 0, -PAD_OFFSET, PAD_SIZE.w + 1, 0.2, PAD_SIZE.d + 1, '#2a2d3a')
  for (let z = -8; z > -STAGE_LENGTH; z -= 16) {
    b.tree(-(CORRIDOR.halfWidth + 8), 20, z, 1.1)
    b.tree(CORRIDOR.halfWidth + 8, 20, z - 8, 1.1)
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
      floor: createStudTexture({ base: '#d7d9e2', alt: '#cdd0da', size: texSize }) as Texture,
      grass: createStudTexture({ base: '#5cee30', alt: '#52de2b', size: texSize }) as Texture,
      brick: createStudTexture({ base: '#c8743e', alt: '#b8662f', studsPerCell: 4, size: texSize }) as Texture,
    }),
    [texSize],
  )
  const geometries = useMemo(() => {
    const floor = createWorldBoxGeometry(CORRIDOR.halfWidth * 2, 1, STAGE_LENGTH, 2)
    floor.translate(0, -0.5, -STAGE_LENGTH / 2)
    return { floor, cliffs: boxes(false, 4), grass: boxes(true, 2), decor: buildDecor() }
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

  useEffect(() => {
    for (const ref of refs) {
      const mesh = ref.current
      if (!mesh) continue
      for (let i = 0; i <= MAX_WINDOW; i += 1) {
        const s = stages[i]
        if (s === undefined) {
          mesh.setMatrixAt(i, HIDDEN)
          continue
        }
        _o.position.set(0, 0, stageStartZ(s))
        _o.rotation.set(0, 0, 0)
        _o.scale.setScalar(1)
        _o.updateMatrix()
        mesh.setMatrixAt(i, _o.matrix)
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

  const geometry = useMemo(() => createWorldBoxGeometry(CORRIDOR.halfWidth * 2, WALL_HEIGHT, WALL_THICKNESS, 4), [])
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
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    for (let w = 0; w < WALLS_PER_STAGE; w += 1) {
      if (w < broken) {
        mesh.setMatrixAt(w, HIDDEN)
        continue
      }
      _o.position.set(0, WALL_HEIGHT / 2, wallZ(stage, w + 1))
      _o.updateMatrix()
      mesh.setMatrixAt(w, _o.matrix)
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
      _o.position.set(shaking.current ? Math.sin(since * 120) * 0.12 : 0, WALL_HEIGHT / 2, wallZ(stage, broken + 1))
      _o.updateMatrix()
      mesh.setMatrixAt(broken, _o.matrix)
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return <instancedMesh ref={ref} args={[geometry, material, WALLS_PER_STAGE]} castShadow receiveShadow frustumCulled={false} />
})

/** Cracks spreading over the active wall as its HP drops. */
function CrackOverlay() {
  const ref = useRef<Mesh>(null)
  const run = useGame((s) => s.run)
  const geometry = useMemo(() => new PlaneGeometry(CORRIDOR.halfWidth * 2 - 0.2, WALL_HEIGHT - 0.2), [])
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        map: getCrackTexture(),
        transparent: true,
        depthWrite: false,
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
  material.opacity = Math.min(1, 0.25 + damage)
  return (
    <mesh
      ref={ref}
      geometry={geometry}
      material={material}
      position={[0, WALL_HEIGHT / 2, wallZ(run.stage, run.wallsBroken + 1) + WALL_THICKNESS / 2 + 0.01]}
      scale={0.55 + damage * 0.45}
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
    () => new MeshBasicMaterial({ color: '#7fe8ff', transparent: true, opacity: 0.22, depthWrite: false, side: DoubleSide }),
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

  useEffect(() => {
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
      _o.position.set(0, 0.15, padZ(s))
      _o.updateMatrix()
      pads.setMatrixAt(i, _o.matrix)
      // A claimed pad dims until the walls respawn.
      _c.set(stageDef(s).accent)
      if (s === runStage && padClaimed) _c.multiplyScalar(0.35)
      pads.setColorAt(i, _c)
      // Gates at or past the active stage stay shut.
      if (s >= runStage) {
        _o.position.set(0, 6, stageStartZ(s) - STAGE_LENGTH)
        _o.updateMatrix()
        gates.setMatrixAt(i, _o.matrix)
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
          center
          zIndexRange={[4, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="flex w-[300px] flex-col items-center">
            <div className="txt-outline text-[34px]">STAGE {run.stage}</div>
            <div className="txt-outline text-[22px]" style={{ color: '#ffd21f' }}>
              {def.material.toUpperCase()}
            </div>
            <div className="progress mt-2" style={{ width: 280, height: 34, borderRadius: 10 }}>
              <div
                className="fill"
                style={{ width: `${(run.wallHp / run.wallMax) * 100}%`, background: 'linear-gradient(180deg,#5dff8a,#1fbf5a)' }}
              />
              <div className="text txt-outline" style={{ fontSize: 24 }}>
                {formatNumber(run.wallHp)}/{formatNumber(run.wallMax)}
              </div>
            </div>
            <div className="txt-outline mt-1 text-[16px]">
              Wall {run.wallsBroken + 1}/{WALLS_PER_STAGE}
            </div>
          </div>
        </Html>
      )}
      {/* DOM labels aren't occluded, so the pad's only shows once the way is clear. */}
      {!wallActive && (
        <Html position={[0, 3.2, padZ(run.stage)]} center zIndexRange={[4, 0]} style={{ pointerEvents: 'none' }}>
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
      <RunLabels stages={stages} />
    </group>
  )
}
