import { useFrame } from '@react-three/fiber'
import { MAX_CLIENTS, TRAILS } from '@game/shared'
import { useEffect, useMemo } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  type Camera,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  MeshBasicMaterial,
  Vector3,
} from 'three'

import { remoteList } from '../../net/remote'
import { game } from '../../state/gameStore'
import { useQuality } from '../../state/qualityStore'
import { localPlayer } from '../runtime'
import { pathPosition, type Projectile, PROJECTILE_CAPACITY, projectiles } from './projectiles'

/**
 * Trail ribbons behind thrown boomerangs (every preset) and players (HIGH). Every
 * ribbon lives in ONE preallocated dynamic geometry — all trails are one draw
 * call. Camera-facing strips that taper and fade towards the tail.
 *
 * A boomerang's trail is sampled from its known flight curve (not from past
 * frames), so it traces the path smoothly at any frame rate.
 */
const SEG = 16
/** How much of the flight (0..1) a boomerang's trail covers behind it. */
const PATH_SPAN = 0.3
const PLAYER_BASE = PROJECTILE_CAPACITY
const RIBBONS = PROJECTILE_CAPACITY + MAX_CLIENTS
const HEADS = TRAILS.map((t) => new Color(t.colors[0]))
const TAILS = TRAILS.map((t) => new Color(t.colors[1]))

const _a = new Vector3()
const _b = new Vector3()
const _dir = new Vector3()
const _view = new Vector3()
const _side = new Vector3()
const _p = new Vector3()

/** Owns the ribbon buffers; `write` is a method so the frame loop allocates nothing. */
class RibbonBuffers {
  readonly geometry = new BufferGeometry()
  private readonly history = new Float32Array(RIBBONS * SEG * 3)
  private readonly filled = new Uint8Array(RIBBONS)
  private readonly positions: Float32Array
  private readonly colors: Float32Array

  constructor() {
    const pos = new BufferAttribute(new Float32Array(RIBBONS * SEG * 2 * 3), 3)
    const col = new BufferAttribute(new Float32Array(RIBBONS * SEG * 2 * 4), 4)
    pos.setUsage(DynamicDrawUsage)
    col.setUsage(DynamicDrawUsage)
    this.geometry.setAttribute('position', pos)
    this.geometry.setAttribute('color', col)
    this.positions = pos.array as Float32Array
    this.colors = col.array as Float32Array
    const index = new Uint16Array(RIBBONS * (SEG - 1) * 6)
    let k = 0
    for (let r = 0; r < RIBBONS; r += 1) {
      for (let s = 0; s < SEG - 1; s += 1) {
        const v = (r * SEG + s) * 2
        index[k++] = v
        index[k++] = v + 1
        index[k++] = v + 2
        index[k++] = v + 1
        index[k++] = v + 3
        index[k++] = v + 2
      }
    }
    this.geometry.setIndex(new BufferAttribute(index, 1))
  }

  hide(r: number): void {
    this.filled[r] = 0
    const C = this.colors
    for (let v = 0; v < SEG * 2; v += 1) C[(r * SEG * 2 + v) * 4 + 3] = 0
  }

  /** A boomerang's trail: SEG points sampled back along its flight curve. */
  writePath(r: number, camera: Camera, p: Projectile, width: number): void {
    const H = this.history
    const h = r * SEG * 3
    for (let s = 0; s < SEG; s += 1) {
      pathPosition(p, Math.max(0, p.t - (s / (SEG - 1)) * PATH_SPAN), _p)
      H[h + s * 3] = _p.x
      H[h + s * 3 + 1] = _p.y
      H[h + s * 3 + 2] = _p.z
    }
    this.filled[r] = 1
    this.build(r, camera, p.trail, width)
  }

  /** A player's trail: the last SEG positions, one per frame. */
  write(r: number, camera: Camera, x: number, y: number, z: number, trail: number, width: number): void {
    const H = this.history
    const h = r * SEG * 3
    if (!this.filled[r]) {
      for (let s = 0; s < SEG; s += 1) {
        H[h + s * 3] = x
        H[h + s * 3 + 1] = y
        H[h + s * 3 + 2] = z
      }
      this.filled[r] = 1
    } else {
      H.copyWithin(h + 3, h, h + (SEG - 1) * 3)
      H[h] = x
      H[h + 1] = y
      H[h + 2] = z
    }
    this.build(r, camera, trail, width)
  }

  /** Turns ribbon r's history points into a camera-facing, tapering strip. */
  private build(r: number, camera: Camera, trail: number, width: number): void {
    const H = this.history
    const P = this.positions
    const C = this.colors
    const h = r * SEG * 3
    const head = HEADS[trail] ?? HEADS[0]
    const tail = TAILS[trail] ?? TAILS[0]
    for (let s = 0; s < SEG; s += 1) {
      const i = h + s * 3
      _a.set(H[i], H[i + 1], H[i + 2])
      if (s < SEG - 1) {
        _b.set(H[i + 3], H[i + 4], H[i + 5])
        _dir.subVectors(_a, _b)
      } else {
        _b.set(H[i - 3], H[i - 2], H[i - 1])
        _dir.subVectors(_b, _a)
      }
      _view.subVectors(camera.position, _a)
      _side.crossVectors(_dir, _view)
      const len = _side.length()
      const k = s / (SEG - 1)
      if (len > 1e-6) _side.multiplyScalar((width * (1 - k * 0.85)) / len)
      else _side.set(0, 0, 0)
      const v = (r * SEG + s) * 2
      P[v * 3] = _a.x + _side.x
      P[v * 3 + 1] = _a.y + _side.y
      P[v * 3 + 2] = _a.z + _side.z
      P[v * 3 + 3] = _a.x - _side.x
      P[v * 3 + 4] = _a.y - _side.y
      P[v * 3 + 5] = _a.z - _side.z
      const cr = head.r + (tail.r - head.r) * k
      const cg = head.g + (tail.g - head.g) * k
      const cb = head.b + (tail.b - head.b) * k
      const alpha = (1 - k) * 0.85
      C[v * 4] = cr
      C[v * 4 + 1] = cg
      C[v * 4 + 2] = cb
      C[v * 4 + 3] = alpha
      C[v * 4 + 4] = cr
      C[v * 4 + 5] = cg
      C[v * 4 + 6] = cb
      C[v * 4 + 7] = alpha
    }
  }

  flush(): void {
    this.geometry.getAttribute('position').needsUpdate = true
    this.geometry.getAttribute('color').needsUpdate = true
  }
}

function Ribbons({ players }: { players: boolean }) {
  const buffers = useMemo(() => new RibbonBuffers(), [])
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        // One pass: three.js would otherwise flip material.side twice a frame.
        forceSinglePass: true,
        toneMapped: false,
      }),
    [],
  )
  useEffect(
    () => () => {
      buffers.geometry.dispose()
      material.dispose()
    },
    [buffers, material],
  )

  useFrame(({ camera }) => {
    for (let i = 0; i < PROJECTILE_CAPACITY; i += 1) {
      const p = projectiles[i]
      if (!p.active) {
        buffers.hide(i)
        continue
      }
      buffers.writePath(i, camera, p, 0.42)
    }

    const data = game().data
    if (players && data) {
      const lp = localPlayer.pos
      buffers.write(PLAYER_BASE, camera, lp.x, lp.y + 0.9, lp.z, data.equippedTrail, 0.45)
    } else buffers.hide(PLAYER_BASE)
    for (let r = 1; r < MAX_CLIENTS; r += 1) {
      const rp = remoteList[r - 1]
      if (players && rp) buffers.write(PLAYER_BASE + r, camera, rp.px, rp.py + 0.9, rp.pz, rp.trail, 0.45)
      else buffers.hide(PLAYER_BASE + r)
    }
    buffers.flush()
  })

  return <mesh geometry={buffers.geometry} material={material} frustumCulled={false} renderOrder={4} />
}

export function TrailRibbons() {
  const playerTrails = useQuality((s) => s.settings.playerTrails)
  return <Ribbons players={playerTrails} />
}

export default TrailRibbons
