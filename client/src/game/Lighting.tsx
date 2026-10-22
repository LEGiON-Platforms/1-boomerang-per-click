import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { type DirectionalLight, Vector3 } from 'three'

import { useQuality } from '../state/qualityStore'
import { localPlayer } from './runtime'
import { LIGHTS } from './sceneStyle'

const SUN_DIRECTION = new Vector3(...(LIGHTS.sunDirection as [number, number, number])).normalize()
const SUN_DISTANCE = 60
const SHADOW_EXTENT = 22

/**
 * Hemisphere fill + one directional sun (the contract's max: 1 directional +
 * ambient). The sun's shadow box follows the player. Realtime shadows are only
 * enabled on MEDIUM/HIGH: on LOW the light casts nothing and no shadow pass runs.
 */
export function Lighting() {
  const sunRef = useRef<DirectionalLight>(null)
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const shadows = useQuality((s) => s.settings.shadows)
  const mapSize = useQuality((s) => s.settings.shadowMapSize)

  useLayoutEffect(() => {
    const sun = sunRef.current
    if (!sun) return undefined
    const cam = sun.shadow.camera
    cam.left = -SHADOW_EXTENT
    cam.right = SHADOW_EXTENT
    cam.top = SHADOW_EXTENT
    cam.bottom = -SHADOW_EXTENT
    cam.near = 1
    cam.far = SUN_DISTANCE * 2
    cam.updateProjectionMatrix()
    scene.add(sun.target)
    return () => {
      scene.remove(sun.target)
    }
  }, [scene])

  // Preset changes: toggling castShadow changes the shader permutation, so
  // materials recompile on their own; the old shadow map is released.
  useEffect(() => {
    const sun = sunRef.current
    if (!sun) return
    gl.shadowMap.enabled = shadows
    sun.castShadow = shadows
    if (sun.shadow.mapSize.x !== mapSize) {
      sun.shadow.mapSize.set(mapSize, mapSize)
      sun.shadow.map?.dispose()
      sun.shadow.map = null
    }
  }, [shadows, mapSize, gl])

  useFrame(() => {
    const sun = sunRef.current
    if (!sun) return
    const p = localPlayer.pos
    sun.target.position.set(p.x, 0, p.z)
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIRECTION, SUN_DISTANCE)
  })

  return (
    <>
      <hemisphereLight args={[LIGHTS.hemiSky, LIGHTS.hemiGround, LIGHTS.hemiIntensity]} />
      <directionalLight
        ref={sunRef}
        color={LIGHTS.sunColor}
        intensity={LIGHTS.sunIntensity}
        shadow-radius={LIGHTS.shadowSoftness}
        shadow-intensity={LIGHTS.shadowIntensity}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />
    </>
  )
}

export default Lighting
