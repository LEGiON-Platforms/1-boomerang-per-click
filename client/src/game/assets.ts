import { BoxGeometry, Color, MeshLambertMaterial } from 'three'

/**
 * Shared geometries and materials (performance contract: created once at module
 * level, reused by every mesh and instance that needs them).
 */

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
