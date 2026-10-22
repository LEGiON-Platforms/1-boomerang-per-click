import { useFrame, useThree } from '@react-three/fiber'
import { CORRIDOR } from '@game/shared'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import { unlockAudio } from '../audio/sfx'
import { cameraState, localPlayer } from './runtime'
import { requestThrow } from './throwing'

const LOOK_HEIGHT = 1.6
const MIN_DISTANCE = 4
const MAX_DISTANCE = 22
const MIN_PITCH = -0.1
const MAX_PITCH = 1.25
const DRAG_SENSITIVITY = 0.005
const TOUCH_SENSITIVITY = 0.008
const ZOOM_SENSITIVITY = 0.012
/** A touch that moves less than this and lifts quickly is a tap = throw. */
const TAP_SLOP_PX = 10
const TAP_MAX_MS = 350

const _desired = new Vector3()
const _target = new Vector3()
const _look = new Vector3()

/**
 * Third-person orbit camera that trails the local player.
 *
 * Mouse: left button throws (dragging also orbits), right-drag orbits, wheel zooms.
 * Touch: tap throws, one-finger drag orbits, pinch zooms.
 */
export function FollowCamera() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const lookAt = useRef(new Vector3())

  useEffect(() => {
    const el = gl.domElement
    const pointers = new Map<number, { x: number; y: number; startX: number; startY: number; t: number; moved: boolean }>()
    let pinchDist = 0

    const onDown = (e: PointerEvent) => {
      unlockAudio()
      el.setPointerCapture?.(e.pointerId)
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, t: performance.now(), moved: false })
      if (e.pointerType === 'mouse' && e.button === 0) requestThrow()
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }

    const onMove = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId)
      if (!p) return
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      if (Math.hypot(p.x - p.startX, p.y - p.startY) > TAP_SLOP_PX) p.moved = true

      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        cameraState.distance = clampDistance(cameraState.distance - (d - pinchDist) * 0.03)
        pinchDist = d
        return
      }
      if (!p.moved) return
      const k = e.pointerType === 'touch' ? TOUCH_SENSITIVITY : DRAG_SENSITIVITY
      cameraState.yaw -= dx * k
      cameraState.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, cameraState.pitch + dy * k))
    }

    const onUp = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId)
      pointers.delete(e.pointerId)
      el.releasePointerCapture?.(e.pointerId)
      if (p && e.pointerType !== 'mouse' && !p.moved && performance.now() - p.t < TAP_MAX_MS && pointers.size === 0) {
        requestThrow()
      }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      cameraState.distance = clampDistance(cameraState.distance + e.deltaY * ZOOM_SENSITIVITY)
    }
    const onContextMenu = (e: Event) => e.preventDefault()

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('contextmenu', onContextMenu)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('contextmenu', onContextMenu)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  useFrame((_s, delta) => {
    const p = localPlayer.pos
    _target.set(p.x, p.y, p.z)
    const { yaw, pitch, distance } = cameraState
    const horizontal = Math.cos(pitch) * distance
    _desired.set(
      _target.x + Math.sin(yaw) * horizontal,
      _target.y + Math.sin(pitch) * distance + LOOK_HEIGHT,
      _target.z + Math.cos(yaw) * horizontal,
    )
    // In the corridor, stay between the cliff walls instead of clipping into them.
    if (_desired.z < 2) {
      const lim = CORRIDOR.halfWidth - 0.6
      _desired.x = Math.min(lim, Math.max(-lim, _desired.x))
    }

    _look.copy(_target)
    _look.y += LOOK_HEIGHT
    if (cameraState.snap) {
      camera.position.copy(_desired)
      lookAt.current.copy(_look)
      cameraState.snap = false
    } else {
      camera.position.lerp(_desired, 1 - Math.pow(0.0001, delta))
      lookAt.current.lerp(_look, 1 - Math.pow(0.00001, delta))
    }

    // Screen shake: a decaying random offset.
    if (cameraState.shake > 0.001) {
      const s = cameraState.shake * 0.35
      camera.position.x += (Math.random() - 0.5) * s
      camera.position.y += (Math.random() - 0.5) * s
      cameraState.shake *= Math.pow(0.02, delta)
    }
    camera.lookAt(lookAt.current)
  })

  return null
}

function clampDistance(d: number): number {
  return Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, d))
}

export default FollowCamera
