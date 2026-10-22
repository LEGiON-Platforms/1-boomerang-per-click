import type { BoomerangShape } from '@game/shared'
import {
  type BufferGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  MeshStandardMaterial,
  Shape,
  Vector2,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import type { Preset } from '../state/qualityStore'
import { type Circle, SHAPES } from './boomerangShapes'

/**
 * 3D boomerangs: each silhouette is extruded with a bevel and gets a hex gem
 * through its elbow. One material per shape (they share a single shader program)
 * paints the pattern, rim and glow from per-instance attributes:
 *   instanceColor  body colour
 *   instanceAccent accent colour
 *   instanceLook   (glow, style) — style = pattern code + 8 if it has a gem
 * The model lies flat in the XZ plane, centred, ~1.7 units across.
 */

const THICKNESS = 0.1
const BEVEL = 0.035

/** Outline points and bevel rings per quality preset (triangle budget per boomerang ≈ 160 / 420 / 700). */
const DETAIL: Record<Preset, { points: number; bevel: number }> = {
  LOW: { points: 22, bevel: 1 },
  MEDIUM: { points: 40, bevel: 2 },
  HIGH: { points: 64, bevel: 2 },
}

function toShape(shape: BoomerangShape): Shape {
  const s = new Shape()
  for (const c of SHAPES[shape].outline) {
    if (c[0] === 'Q') s.quadraticCurveTo(c[1], c[2], c[3], c[4])
    else if (c[0] === 'M') s.moveTo(c[1], c[2])
    else s.lineTo(c[1], c[2])
  }
  return s
}

const centers = new Map<BoomerangShape, Vector2>()

/** Outline bounding-box centre; the model is shifted so this sits at the origin. */
function shapeCenter(shape: BoomerangShape): Vector2 {
  let c = centers.get(shape)
  if (!c) {
    const pts = toShape(shape).getPoints(8)
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (const p of pts) {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    }
    c = new Vector2((minX + maxX) / 2, (minY + maxY) / 2)
    centers.set(shape, c)
  }
  return c
}

function setPart(g: BufferGeometry, part: number): void {
  const n = g.getAttribute('position').count
  g.setAttribute('part', new Float32BufferAttribute(new Float32Array(n).fill(part), 1))
}

/** A new geometry (caller disposes): bevelled body (part 0) + gem (part 1). */
export function buildBoomerangGeometry(shape: BoomerangShape, preset: Preset): BufferGeometry {
  const def = SHAPES[shape]
  const detail = DETAIL[preset]
  const curves = def.outline.filter((c) => c[0] === 'Q').length
  const body = new ExtrudeGeometry(toShape(shape), {
    depth: THICKNESS,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: detail.bevel,
    curveSegments: Math.max(1, Math.round(detail.points / curves)),
  })
  body.translate(0, 0, -THICKNESS / 2)
  body.deleteAttribute('uv')
  setPart(body, 0)

  // Hex gem: a prism through the plate with a low pyramid on each face.
  const [gx, gy, gr] = def.gem
  const face = THICKNESS / 2 + BEVEL + 0.008
  const lathe = new LatheGeometry(
    [new Vector2(0, -face - 0.045), new Vector2(gr, -face), new Vector2(gr, face), new Vector2(0, face + 0.045)],
    6,
  )
  const gem = lathe.toNonIndexed()
  lathe.dispose()
  gem.deleteAttribute('uv')
  gem.rotateX(Math.PI / 2)
  gem.translate(gx, gy, 0)
  gem.computeVertexNormals() // non-indexed → flat facets
  setPart(gem, 1)

  const merged = mergeGeometries([body, gem])
  body.dispose()
  gem.dispose()
  if (!merged) throw new Error(`boomerang geometry merge failed: ${shape}`)
  // Lay it flat: outline (x, y) → (x, −y) in XZ, thickness along Y.
  merged.rotateX(-Math.PI / 2)
  const c = shapeCenter(shape)
  merged.translate(-c.x, 0, c.y)
  merged.computeBoundingSphere()
  return merged
}

export interface HoldPose {
  /** Model-space point the hand grips: the outermost tip. */
  grip: Vector3
  /**
   * Roll (radians) about the facing axis, once the model is stood upright facing
   * forward: points grip → centre straight up, leaning a little outward.
   */
  roll: number
  /** Yaw (radians, added to the facing) that lays it flat, pointing forward-right, mid throw. */
  flatYaw: number
}

const holdPoses = new Map<BoomerangShape, HoldPose>()

/** How a hand holds this shape: by its outermost tip, the body standing up beside the shoulder. */
export function holdPose(shape: BoomerangShape): HoldPose {
  let h = holdPoses.get(shape)
  if (!h) {
    const c = shapeCenter(shape)
    const tip = SHAPES[shape].tips.reduce((a, b) => (b[0] < a[0] ? b : a))
    h = {
      grip: new Vector3(tip[0] - c.x, 0, c.y - tip[1]),
      roll: Math.PI / 2 + 0.35 - Math.atan2(c.y - tip[1], c.x - tip[0]),
      // Grip → centre in the flat model is (c.x − tip.x, tip.y − c.y) in XZ.
      flatYaw: -Math.PI / 4 - Math.atan2(c.x - tip[0], tip[1] - c.y),
    }
    holdPoses.set(shape, h)
  }
  return h
}

/** Shared animation clock for every boomerang material (rainbow + sheen). */
const timeUniform = { value: 0 }
export function setBoomerangTime(t: number): void {
  timeUniform.value = t
}

const MAX_TIPS = 5

const VERTEX_HEAD = /* glsl */ `
attribute float part;
attribute vec3 instanceAccent;
attribute vec2 instanceLook;
varying vec3 vBody;
varying vec3 vAccent;
varying vec2 vLook;
varying vec2 vP;
varying float vPart;
varying float vFace;
`

const VERTEX_BODY = /* glsl */ `
vBody = vec3(1.0);
#ifdef USE_INSTANCING_COLOR
  vBody = instanceColor;
#endif
vAccent = instanceAccent;
vLook = instanceLook;
vP = position.xz;
vPart = part;
vFace = abs(normal.y);
// No gem on this tier: fold the gem into the middle of the plate.
if (part > 0.5 && instanceLook.y < 7.5) transformed = vec3(0.0);
`

const FRAGMENT_HEAD = /* glsl */ `
uniform vec3 uTips[${MAX_TIPS}];
uniform int uTipCount;
uniform vec3 uCore;
uniform float uTime;
varying vec3 vBody;
varying vec3 vAccent;
varying vec2 vLook;
varying vec2 vP;
varying float vPart;
varying float vFace;
vec3 bmHue(float h) {
  return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}
`

const FRAGMENT_COLOR = /* glsl */ `
float bmPattern = mod(vLook.y, 8.0);
float bmTip = 10.0;
for (int i = 0; i < ${MAX_TIPS}; i++) {
  if (i >= uTipCount) break;
  bmTip = min(bmTip, distance(vP, uTips[i].xy) - uTips[i].z);
}
vec3 bmTone = vBody;
float bmAccent = 0.0;
if (bmPattern < 0.5) {
} else if (bmPattern < 1.5) {
  bmAccent = step(bmTip, 0.0);
} else if (bmPattern < 2.5) {
  bmAccent = max(step(abs(bmTip + 0.02), 0.035), step(abs(bmTip - 0.11), 0.035));
} else if (bmPattern < 3.5) {
  bmAccent = step(fract(dot(vP, vec2(2.4, 1.5))), 0.4);
} else if (bmPattern < 4.5) {
  bmTone *= 0.86 + 0.14 * sin(vP.x * 34.0 + sin(vP.y * 9.0) * 2.5);
} else if (bmPattern < 5.5) {
  bmAccent = step(distance(vP, uCore.xy), uCore.z);
} else if (bmPattern < 6.5) {
  bmAccent = step(0.0, vP.x);
} else {
  bmTone = mix(bmHue(fract(atan(vP.y, vP.x) / 6.2832 + uTime * 0.15)), vec3(1.0), 0.12);
}
bmTone = mix(bmTone, vAccent, bmAccent);
// Bevel and side walls take the accent too, so the silhouette reads at any size.
float bmRim = 1.0 - smoothstep(0.55, 0.8, vFace);
bmTone = mix(bmTone, vAccent * 0.8, bmRim * 0.65);
if (vPart > 0.5) bmTone = mix(vAccent, vec3(1.0), 0.35);
diffuseColor.rgb = bmTone;
`

const FRAGMENT_ROUGHNESS = /* glsl */ `
roughnessFactor = mix(roughnessFactor, 0.12, step(0.5, vPart));
`

const FRAGMENT_EMISSIVE = /* glsl */ `
float bmGlow = vLook.x;
totalEmissiveRadiance += diffuseColor.rgb * (bmGlow * 0.75 + step(0.5, vPart) * (0.3 + bmGlow * 0.5));
// Top tiers: a bright sheen sweeps across the blade.
float bmSweep = pow(max(0.0, sin(dot(vP, vec2(2.0, 1.2)) * 2.5 - uTime * 4.0)), 16.0);
totalEmissiveRadiance += vec3(bmSweep * smoothstep(0.85, 1.0, bmGlow) * 0.9);
`

/** Shape-specific circle (outline space) → shader space (centred XZ) + radius. */
function toShader(shape: BoomerangShape, c: Circle): Vector3 {
  const center = shapeCenter(shape)
  return new Vector3(c[0] - center.x, center.y - c[1], c[2])
}

/** One per shape; all of them compile to the same program. */
export function createBoomerangMaterial(shape: BoomerangShape): MeshStandardMaterial {
  const def = SHAPES[shape]
  const tips = Array.from({ length: MAX_TIPS }, (_, i) =>
    i < def.tips.length ? toShader(shape, def.tips[i]) : new Vector3(),
  )
  const m = new MeshStandardMaterial({ roughness: 0.4, metalness: 0.12 })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTips = { value: tips }
    shader.uniforms.uTipCount = { value: def.tips.length }
    shader.uniforms.uCore = { value: toShader(shape, def.core) }
    shader.uniforms.uTime = timeUniform
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_HEAD}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX_BODY}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_HEAD}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAGMENT_COLOR}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${FRAGMENT_ROUGHNESS}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${FRAGMENT_EMISSIVE}`)
  }
  m.customProgramCacheKey = () => 'boomerang-v2'
  return m
}
