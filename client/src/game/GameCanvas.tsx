import { PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { PerspectiveCamera, WebGLRenderer } from 'three'

import { useGame } from '../state/gameStore'
import { useQuality } from '../state/qualityStore'
import { BoomerangInstances } from './fx/BoomerangInstances'
import { ParticleSystem } from './fx/ParticleSystem'
import { TrailRibbons } from './fx/TrailRibbons'
import { FollowCamera } from './FollowCamera'
import { Lighting } from './Lighting'
import { Lobby } from './lobby/Lobby'
import { LuckyBlock } from './LuckyBlock'
import { Pets } from './pets/Pets'
import { LocalPlayer } from './player/LocalPlayer'
import { RemotePlayers } from './player/RemotePlayers'
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
  }
}

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

/** Fires once after the renderer has actually drawn a frame. */
function FirstFrame({ onFirstFrame }: { onFirstFrame: () => void }) {
  const fired = useRef(false)
  useFrame(() => {
    if (fired.current) return
    fired.current = true
    onFirstFrame()
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
  const nearCorridor = useGame((s) => s.nearCorridor)
  // Remounting the Canvas is the reliable way back from a lost WebGL context.
  const [canvasKey, setCanvasKey] = useState(0)
  const [contextLost, setContextLost] = useState(false)

  const onCreated = ({ gl }: { gl: WebGLRenderer }) => {
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
        camera={{ fov: 60, near: 0.1, far: settings.viewDistance, position: [0, 6, 36] }}
        onCreated={onCreated}
      >
        <PerformanceMonitor bounds={() => [45, 75]} flipflops={3} onDecline={drop} />
        <CameraSettings />
        <fog attach="fog" args={[FOG.color, settings.fogNear, settings.viewDistance]} />
        <Sky />
        <Lighting />
        <Lobby />
        {nearCorridor && (
          <Suspense fallback={null}>
            <StageCorridor />
          </Suspense>
        )}
        <Suspense fallback={null}>
          <LocalPlayer onAvatarReady={onAvatarReady} />
        </Suspense>
        <RemotePlayers />
        <Pets />
        <LuckyBlock />
        <BoomerangInstances />
        <TrailRibbons />
        <ParticleSystem />
        {children}
        <FollowCamera />
        <FirstFrame onFirstFrame={onFirstFrame} />
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
