import { CORRIDOR, WALL_HEIGHT, WALL_THICKNESS } from '@game/shared'
import { BoxGeometry, type BufferGeometry, Float32BufferAttribute, MeshLambertMaterial } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * A breaking wall: the wall cut into ~30 brick-like chunks, each textured with
 * exactly the part of the wall it came from. The whole burst — chunks flying out
 * from the impact point, tumbling, dropping to the floor and shrinking away — is
 * worked out in the vertex shader from one time uniform, so a break costs one
 * draw call and no per-frame CPU work beyond setting that uniform.
 */

/** Seconds from impact until the last chunk has shrunk away. */
export const SHATTER_TIME = 1.8

const W = CORRIDOR.halfWidth * 2
/** Chunk row heights, bottom up (they add up to the wall's height). */
const ROWS = [0.22, 0.2, 0.2, 0.19, 0.19].map((f) => f * WALL_HEIGHT)
const GAP = 0.05

/** Small deterministic PRNG, so every wall of a kind breaks the same way. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Chunks in wall space: x across the corridor, y up from the floor, z through the
 * wall. UVs follow createWorldBoxGeometry's rule, so the chunks line up with the
 * wall texture at the same `tile`.
 */
export function createShatterGeometry(tile: number): BufferGeometry {
  const rand = rng(tile * 7919)
  const parts: BufferGeometry[] = []
  let y0 = 0
  for (let r = 0; r < ROWS.length; r += 1) {
    const h = ROWS[r]
    // Brick-like rows: random widths, the row's last chunk takes what's left.
    const widths: number[] = []
    let left = W
    while (left > 0) {
      let w = 2 + rand() * 1.6
      if (left - w < 1.4) w = left
      widths.push(w)
      left -= w
    }
    let x0 = -W / 2
    for (const w of widths) {
      // Vertices stay relative to the chunk's centre (the shader moves the centre).
      const g = new BoxGeometry(w - GAP, h - GAP, WALL_THICKNESS)
      const cx = x0 + w / 2
      const cy = y0 + h / 2
      const pos = g.getAttribute('position')
      const nor = g.getAttribute('normal')
      const uv = g.getAttribute('uv')
      for (let i = 0; i < pos.count; i += 1) {
        const x = pos.getX(i) + cx + W / 2
        const y = pos.getY(i) + cy
        const z = pos.getZ(i) + WALL_THICKNESS / 2
        if (Math.abs(nor.getX(i)) > 0.5) uv.setXY(i, z / tile, y / tile)
        else if (Math.abs(nor.getY(i)) > 0.5) uv.setXY(i, x / tile, z / tile)
        else uv.setXY(i, x / tile, y / tile)
      }
      const n = pos.count
      const center = new Float32Array(n * 3)
      const motion = new Float32Array(n * 4)
      const spin = new Float32Array(n * 4)
      // Out-push, lift, backwards speed, start jitter; tumble axis + speed.
      const push = 1 + rand() * 2.5
      const lift = 1 + rand() * 3
      const back = 1 + rand() * 2.5
      const jitter = rand() * 0.06
      let ax = rand() - 0.5
      let ay = rand() - 0.5
      let az = rand() - 0.5
      const len = Math.hypot(ax, ay, az) || 1
      ax /= len
      ay /= len
      az /= len
      const turn = (4 + rand() * 7) * (rand() < 0.5 ? -1 : 1)
      for (let i = 0; i < n; i += 1) {
        center.set([cx, cy, 0], i * 3)
        motion.set([push, lift, back, jitter], i * 4)
        spin.set([ax, ay, az, turn], i * 4)
      }
      g.setAttribute('aCenter', new Float32BufferAttribute(center, 3))
      g.setAttribute('aMotion', new Float32BufferAttribute(motion, 4))
      g.setAttribute('aSpin', new Float32BufferAttribute(spin, 4))
      parts.push(g)
      x0 += w
    }
    y0 += h
  }
  const merged = mergeGeometries(parts)
  for (const p of parts) p.dispose()
  return merged
}

export interface ShatterUniforms {
  uT: { value: number }
  uImpact: { value: { x: number; y: number } }
}

const VERTEX_HEAD = /* glsl */ `
uniform float uT;
uniform vec2 uImpact;
attribute vec3 aCenter;
attribute vec4 aMotion;
attribute vec4 aSpin;
mat3 shatterRot(vec3 a, float ang) {
  float s = sin(ang);
  float c = cos(ang);
  float oc = 1.0 - c;
  return mat3(
    oc * a.x * a.x + c, oc * a.x * a.y + a.z * s, oc * a.z * a.x - a.y * s,
    oc * a.x * a.y - a.z * s, oc * a.y * a.y + c, oc * a.y * a.z + a.x * s,
    oc * a.z * a.x + a.y * s, oc * a.y * a.z - a.x * s, oc * a.z * a.z + c);
}
`

// Chunks near the impact go first and fastest; the rest crumble a moment later.
const VERTEX_NORMAL = /* glsl */ `
vec2 shOff = aCenter.xy - uImpact;
float shDist = length(shOff);
vec2 shDir = shOff / max(shDist, 0.001);
float shT = max(uT - shDist * 0.022 - aMotion.w, 0.0);
float shNear = 1.0 / (1.0 + shDist * 0.22);
float shDamp = (1.0 - exp(-1.7 * shT)) / 1.7;
mat3 shR = shatterRot(aSpin.xyz, aSpin.w * shDamp);
vec3 objectNormal = shR * vec3(normal);
#ifdef USE_TANGENT
vec3 objectTangent = vec3(tangent.xyz);
#endif
`

const VERTEX_POSITION = /* glsl */ `
vec3 shV = vec3(shDir.x * aMotion.x * (0.5 + shNear), aMotion.y * (0.4 + shNear) + shDir.y * 1.5, -aMotion.z * (0.6 + shNear));
vec3 shC = aCenter + vec3(shV.x, 0.0, shV.z) * shDamp;
shC.y = max(aCenter.y + shV.y * shT - 11.0 * shT * shT, 0.45);
float shScale = 1.0 - smoothstep(${(SHATTER_TIME - 0.45).toFixed(2)}, ${SHATTER_TIME.toFixed(2)}, uT);
vec3 transformed = shR * (position * shScale) + shC;
`

/** The wall's own look (map, glow), driven by `uniforms`. */
export function createShatterMaterial(wall: MeshLambertMaterial, uniforms: ShatterUniforms): MeshLambertMaterial {
  const m = new MeshLambertMaterial({ map: wall.map, emissive: wall.emissive, emissiveMap: wall.emissiveMap, emissiveIntensity: wall.emissiveIntensity })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uT = uniforms.uT
    shader.uniforms.uImpact = uniforms.uImpact
    shader.vertexShader = VERTEX_HEAD + shader.vertexShader
      .replace('#include <beginnormal_vertex>', VERTEX_NORMAL)
      .replace('#include <begin_vertex>', VERTEX_POSITION)
  }
  m.customProgramCacheKey = () => 'wall-shatter'
  return m
}
