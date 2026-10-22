import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Collects many coloured primitives and merges them into ONE BufferGeometry with
 * vertex colours, so a whole set of static props renders in a single draw call.
 * Build-time only (component mount), never per frame.
 */
export class PropBuilder {
  private parts: BufferGeometry[] = []
  private readonly m = new Matrix4()
  private readonly q = new Quaternion()
  private readonly up = new Vector3(0, 1, 0)
  private readonly c = new Color()

  private push(geo: BufferGeometry, color: string, x: number, y: number, z: number, rotY: number, rotX = 0): this {
    // Merging needs identical attribute sets: drop UVs, add a flat colour.
    geo.deleteAttribute('uv')
    const g = geo.index ? geo.toNonIndexed() : geo
    if (g !== geo) geo.dispose()
    this.c.set(color)
    const n = g.getAttribute('position').count
    const colors = new Float32Array(n * 3)
    for (let i = 0; i < n; i += 1) {
      colors[i * 3] = this.c.r
      colors[i * 3 + 1] = this.c.g
      colors[i * 3 + 2] = this.c.b
    }
    g.setAttribute('color', new Float32BufferAttribute(colors, 3))
    if (rotX) g.rotateX(rotX)
    this.q.setFromAxisAngle(this.up, rotY)
    this.m.compose(new Vector3(x, y, z), this.q, new Vector3(1, 1, 1))
    g.applyMatrix4(this.m)
    this.parts.push(g)
    return this
  }

  /** Axis-aligned (then Y-rotated) box; (x, y, z) is the box centre. */
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, rotY = 0): this {
    return this.push(new BoxGeometry(sx, sy, sz), color, x, y, z, rotY)
  }

  /** Box resting on the ground: y is its base. */
  block(x: number, baseY: number, z: number, sx: number, sy: number, sz: number, color: string, rotY = 0): this {
    return this.box(x, baseY + sy / 2, z, sx, sy, sz, color, rotY)
  }

  cylinder(x: number, baseY: number, z: number, r: number, h: number, color: string, segments = 16, rTop = r): this {
    return this.push(new CylinderGeometry(rTop, r, h, segments), color, x, baseY + h / 2, z, 0)
  }

  cone(x: number, baseY: number, z: number, r: number, h: number, color: string, segments = 8): this {
    return this.push(new ConeGeometry(r, h, segments), color, x, baseY + h / 2, z, 0)
  }

  /** A blocky Roblox-style tree. */
  tree(x: number, baseY: number, z: number, scale = 1): this {
    this.block(x, baseY, z, 0.8 * scale, 2.4 * scale, 0.8 * scale, '#7a4b2a')
    this.block(x, baseY + 2.2 * scale, z, 3.2 * scale, 1.6 * scale, 3.2 * scale, '#2f9e44')
    this.block(x, baseY + 3.8 * scale, z, 2.2 * scale, 1.2 * scale, 2.2 * scale, '#37b24d')
    return this
  }

  /** A blocky pumpkin (decoration only — collectible ones are instanced). */
  pumpkin(x: number, baseY: number, z: number, s = 1): this {
    this.block(x, baseY, z, 1.6 * s, 1.2 * s, 1.6 * s, '#ff8a1f')
    this.block(x, baseY + 0.05 * s, z, 1.75 * s, 1.0 * s, 1.1 * s, '#f57f17')
    this.block(x, baseY + 1.2 * s, z, 0.25 * s, 0.4 * s, 0.25 * s, '#5d3a1a')
    return this
  }

  get empty(): boolean {
    return this.parts.length === 0
  }

  build(): BufferGeometry {
    const merged = mergeGeometries(this.parts, false)
    for (const p of this.parts) p.dispose()
    this.parts = []
    if (!merged) throw new Error('PropBuilder: nothing to merge')
    merged.computeBoundingSphere()
    return merged
  }
}
