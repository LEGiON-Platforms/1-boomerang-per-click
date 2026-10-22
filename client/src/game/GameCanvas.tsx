import { PerformanceMonitor } from '@react-three/drei'
import { Canvas, type EventManager, useFrame, useThree } from '@react-three/fiber'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import type { Camera, Material, PerspectiveCamera, Scene, Texture, WebGLRenderer } from 'three'

import { useQuality } from '../state/qualityStore'
import { BoomerangInstances } from './fx/BoomerangInstances'
import { ParticleSystem } from './fx/ParticleSystem'
import { TrailRibbons } from './fx/TrailRibbons'
import { FollowCamera } from './FollowCamera'
import { Lighting } from './Lighting'
import { Lobby } from './lobby/Lobby'
import { LuckyBlock } from './LuckyBlock'
import { NameTagProjector } from './NameTagProjector'
import { Pets } from './pets/Pets'
import { Pumpkins } from './Pumpkins'
import { LocalPlayer } from './player/LocalPlayer'
import { RemoteAvatars } from './player/RemoteAvatars'
import { RemotePlayers } from './player/RemotePlayers'
import { view } from './runtime'
import { FOG, SKY } from './sceneStyle'
import { Sky } from './Sky'

// Stages load on demand (React.lazy): the lobby is playable before this chunk exists.
const StageCorridor = lazy(() => import('./corridor/StageCorridor'))

// Dev-only overlay: the static DEV check lets the production build drop r3f-perf.
const PerfOverlay = import.meta.env.DEV
  ? lazy(() => import('r3f-perf').then((m) => ({ default: m.Perf })))
  : null

declare global {
  interface Window {
    /** Read by tools/perf-probe.ts: last frame's renderer counters. */
    __bpcRenderInfo?: () => { calls: number; triangles: number; textures: number; geometries: number; programs: number }
    /** Read by tools/perf-probe.ts: textures in the scene and their estimated GPU bytes. */
    __bpcTextureStats?: () => { count: number; bytes: number; largest: number }
  }
}

/** Unique textures used by materials in the scene, with an RGBA8 + mipmaps size estimate. */
function textureStats(scene: Scene): { count: number; bytes: number; largest: number } {
  const seen = new Set<Texture>()
  scene.traverse((o) => {
    const mats = (o as { material?: Material | Material[] }).material
    if (!mats) return
    for (const m of Array.isArray(mats) ? mats : [mats]) {
      for (const key of ['map', 'emissiveMap', 'alphaMap', 'normalMap'] as const) {
        const t = (m as unknown as Record<string, Texture | null | undefined>)[key]
        if (t) seen.add(t)
      }
    }
  })
  let bytes = 0
  let largest = 0
  for (const t of seen) {
    const img = t.image as { width?: number; height?: number } | undefined
    const w = img?.width ?? 0
    const h = img?.height ?? 0
    largest = Math.max(largest, w, h)
    bytes += w * h * 4 * (t.generateMipmaps ? 4 / 3 : 1)
  }
  return { count: seen.size, bytes, largest }
}

/**
 * No R3F pointer events: nothing in the scene uses onClick/onPointer handlers
 * (camera and throwing listen on the canvas directly), and R3F's default manager
 * would still set up a raycast on every pointer event.
 */
const noEvents = (): EventManager<HTMLElement> => ({
  enabled: false,
  priority: 0,
  handlers: undefined,
  connected: undefined,
  connect: () => {},
  disconnect: () => {},
  update: () => {},
})

/** Applies preset-driven camera settings that the Canvas prop only sets once. */
function CameraSettings() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const far = useQuality((s) => s.settings.viewDistance)
  useEffect(() => {
    camera.far = far
    camera.updateProjectionMatrix()
  }, [camera, far])
  return null
}

/**
 * Fires once after the renderer has actually drawn a frame. The callback (which
 * sets React state) is queued outside the frame loop, never run inside useFrame.
 */
function FirstFrame({ onFirstFrame }: { onFirstFrame: () => void }) {
  const fired = useRef(false)
  useFrame(() => {
    if (fired.current) return
    fired.current = true
    window.setTimeout(onFirstFrame, 0)
  })
  return null
}

interface Props {
  onAvatarReady: () => void
  onFirstFrame: () => void
  children?: React.ReactNode
}

export function GameCanvas({ onAvatarReady, onFirstFrame, children }: Props) {
  const settings = useQuality((s) => s.settings)
  const showPerf = useQuality((s) => s.showPerf)
  const drop = useQuality((s) => s.drop)
  // The lobby renders first; the stage corridor chunk loads right after the first
  // frame and stays mounted, so the walls are visible through the gate from
  // anywhere in the lobby. (It draws only the current stage and its neighbours.)
  const [showCorridor, setShowCorridor] = useState(false)
  const handleFirstFrame = useCallback(() => {
    setShowCorridor(true)
    onFirstFrame()
  }, [onFirstFrame])
  // Remounting the Canvas is the reliable way back from a lost WebGL context.
  const [canvasKey, setCanvasKey] = useState(0)
  const [contextLost, setContextLost] = useState(false)

  const onCreated = ({ gl, scene, camera }: { gl: WebGLRenderer; scene: Scene; camera: Camera }) => {
    view.camera = camera
    gl.setClearColor(SKY.horizon)
    const el = gl.domElement
    el.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      setContextLost(true)
    })
    el.addEventListener('webglcontextrestored', () => {
      setContextLost(false)
      setCanvasKey((k) => k + 1)
    })
    window.__bpcRenderInfo = () => ({
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      textures: gl.info.memory.textures,
      geometries: gl.info.memory.geometries,
      programs: gl.info.programs?.length ?? 0,
    })
    window.__bpcTextureStats = () => textureStats(scene)
    if (import.meta.env.DEV) (window as unknown as { __bpcScene: Scene }).__bpcScene = scene
  }

  return (
    <>
      <Canvas
        key={canvasKey}
        className="game-canvas"
        dpr={settings.dpr}
        shadows={settings.shadows ? 'percentage' : false}
        // No tone mapping: the toy-brick colours in sceneStyle are picked to look right as-is.
        flat
        gl={{ antialias: settings.antialias, powerPreference: 'high-performance', stencil: false }}
        // near 0.3 (not 0.1): three times the depth precision, so stacked floors and pads never z-fight.
        camera={{ fov: 60, near: 0.3, far: settings.viewDistance, position: [0, 6, 36] }}
        events={noEvents}
        onCreated={onCreated}
      >
        <PerformanceMonitor bounds={() => [45, 75]} flipflops={3} onDecline={drop} />
        <CameraSettings />
        <fog attach="fog" args={[FOG.color, settings.fogNear, settings.viewDistance]} />
        <Sky />
        <Lighting />
        <Lobby />
        {showCorridor && (
          <Suspense fallback={null}>
            <StageCorridor />
          </Suspense>
        )}
        <LocalPlayer onAvatarReady={onAvatarReady} />
        <RemotePlayers />
        <RemoteAvatars />
        <Pets />
        <LuckyBlock />
        <Pumpkins />
        <BoomerangInstances />
        <TrailRibbons />
        <ParticleSystem />
        {children}
        <NameTagProjector />
        <FollowCamera />
        <FirstFrame onFirstFrame={handleFirstFrame} />
        {PerfOverlay && showPerf && (
          <Suspense fallback={null}>
            <PerfOverlay position="top-left" />
          </Suspense>
        )}
      </Canvas>
      {contextLost && (
        <div className="overlay-center">
          <div className="panel-card txt-outline">Restoring graphics…</div>
        </div>
      )}
    </>
  )
}

export default GameCanvas
