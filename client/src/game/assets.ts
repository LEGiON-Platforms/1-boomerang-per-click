import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  InstancedBufferAttribute,
  type InstancedMesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Shape,
} from 'three'

/**
 * Shared geometries and materials (performance contract: created once at module
 * level, reused by every mesh and instance that needs them).
 */

/* ---------------------------------------------------------------------------
 * Boomerang
 * ------------------------------------------------------------------------- */

function boomerangShape(): Shape {
  // A classic V boomerang, ~1.7 units tip to tip, drawn in the XY plane.
  const s = new Shape()
  s.moveTo(0, 0.34)
  s.lineTo(0.78, -0.2)
  s.quadraticCurveTo(0.92, -0.32, 0.78, -0.44)
  s.lineTo(0, 0.06)
  s.lineTo(-0.78, -0.44)
  s.quadraticCurveTo(-0.92, -0.32, -0.78, -0.2)
  s.lineTo(0, 0.34)
  return s
}

let boomerangGeo: BufferGeometry | null = null

/** Low-poly extruded boomerang lying flat in the XZ plane, centred on its elbow. */
export function getBoomerangGeometry(): BufferGeometry {
  if (!boomerangGeo) {
    const g = new ExtrudeGeometry(boomerangShape(), {
      depth: 0.09,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 1,
      curveSegments: 3,
    })
    g.translate(0, 0, -0.045)
    g.rotateX(-Math.PI / 2)
    g.computeVertexNormals()
    boomerangGeo = g
  }
  return boomerangGeo
}

/* ---------------------------------------------------------------------------
 * Instanced material with a per-instance glow
 * ------------------------------------------------------------------------- */

/**
 * A MeshStandardMaterial whose instances each pick a glow amount through an
 * `instanceGlow` attribute: emissive = instanceColor × glow. Lets every tier of
 * boomerang (matte wood … glowing plasma) share one draw call.
 */
export function createGlowInstancedMaterial(): MeshStandardMaterial {
  const m = new MeshStandardMaterial({ roughness: 0.45, metalness: 0.15 })
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float instanceGlow;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = instanceGlow;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow * 0.9;',
      )
  }
  m.customProgramCacheKey = () => 'glow-instanced'
  return m
}

/** Adds the per-instance glow attribute that createGlowInstancedMaterial reads. */
export function attachGlowAttribute(mesh: InstancedMesh, capacity: number): InstancedBufferAttribute {
  const attr = new InstancedBufferAttribute(new Float32Array(capacity), 1)
  mesh.geometry.setAttribute('instanceGlow', attr)
  return attr
}

/* ---------------------------------------------------------------------------
 * Two-tone instanced material (pets): body = instanceColor, accent = instanceAccent
 * ------------------------------------------------------------------------- */

/**
 * Vertices carry a `part` attribute: 0 body (instance colour), 1 accent
 * (per-instance accent colour), 2 black (eyes), 3 white. One draw call per shape
 * renders every player's pets in their own colours.
 */
export function createTwoToneMaterial(): MeshLambertMaterial {
  const m = new MeshLambertMaterial()
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float part;\nattribute vec3 instanceAccent;\nattribute float instanceGlow;\nvarying vec3 vTone;\nvarying float vGlow;',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 bodyCol = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          bodyCol = instanceColor;
        #endif
        vTone = part < 0.5 ? bodyCol : (part < 1.5 ? instanceAccent : (part < 2.5 ? vec3(0.03) : vec3(1.0)));
        vGlow = instanceGlow;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTone;\nvarying float vGlow;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = vTone;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vTone * vGlow;',
      )
  }
  m.customProgramCacheKey = () => 'two-tone'
  return m
}

/* ---------------------------------------------------------------------------
 * Common primitives
 * ------------------------------------------------------------------------- */

export const unitBox = new BoxGeometry(1, 1, 1)

/** Lambert is cheaper than Standard and looks right for flat toy plastic. */
export const vertexColorLambert = new MeshLambertMaterial({ vertexColors: true })

const _c = new Color()

/** Writes a hex colour into a Float32Array at index i (r, g, b). */
export function writeColor(arr: Float32Array, i: number, hex: string | number): void {
  _c.set(hex)
  arr[i * 3] = _c.r
  arr[i * 3 + 1] = _c.g
  arr[i * 3 + 2] = _c.b
}
