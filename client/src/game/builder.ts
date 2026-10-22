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
const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3()
const UP = new Vector3(0, 1, 0)

/**
 * Repeated decorations (trees, pumpkins) are built once and then copied: a merged
 * template is far cheaper to clone than rebuilding a dozen primitives each time.
 */
const templates = new Map<string, BufferGeometry>()

function template(key: string, build: (b: PropBuilder) => void): BufferGeometry {
  let t = templates.get(key)
  if (!t) {
    const b = new PropBuilder()
    build(b)
    t = b.build()
    templates.set(key, t)
  }
  return t
}

export class PropBuilder {
  private parts: BufferGeometry[] = []
  private readonly c = new Color()

  /** Adds a copy of an already-coloured part (e.g. a template) at a transform. */
  private stamp(geo: BufferGeometry, x: number, y: number, z: number, rotY: number, scale: number): this {
    const g = geo.clone()
    _q.setFromAxisAngle(UP, rotY)
    _m.compose(_p.set(x, y, z), _q, _s.setScalar(scale))
    g.applyMatrix4(_m)
    this.parts.push(g)
    return this
  }

  private push(geo: BufferGeometry, color: string, x: number, y: number, z: number, rotY: number, rotX = 0): this {
    // Merging needs identical attribute sets: drop UVs, add a flat colour. Parts stay
    // indexed (three's primitives are), which keeps the merged mesh small and the
    // build fast — no per-part expansion to separate triangles.
    geo.deleteAttribute('uv')
    const g = geo
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
    _q.setFromAxisAngle(UP, rotY)
    _m.compose(_p.set(x, y, z), _q, _s.setScalar(1))
    g.applyMatrix4(_m)
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
    const t = template('tree', (b) => {
      b.block(0, 0, 0, 0.8, 2.4, 0.8, '#7a4b2a')
      b.block(0, 2.2, 0, 3.2, 1.6, 3.2, '#2f9e44')
      b.block(0, 3.8, 0, 2.2, 1.2, 2.2, '#37b24d')
    })
    return this.stamp(t, x, baseY, z, 0, scale)
  }

  /**
   * A voxel jack-o'-lantern: ribbed body, a carved glowing face on its local +Z
   * side (turned by rotY), stem and leaf. About 1.75·s wide and 1.4·s tall.
   */
  pumpkin(x: number, baseY: number, z: number, s = 1, rotY = 0): this {
    return this.stamp(template('pumpkin', buildPumpkin), x, baseY, z, rotY, s)
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

/** The jack-o'-lantern template at the origin, facing +Z, scale 1. */
function buildPumpkin(b: PropBuilder): void {
  // A part at local (lx, ly, lz), size (w, h, d); y is its base.
  const part = (lx: number, ly: number, lz: number, w: number, h: number, d: number, color: string) =>
    b.block(lx, ly, lz, w, h, d, color)
  // Body: three overlapping slabs read as rounded ribs.
  part(0, 0.06, 0, 1.75, 1.05, 1.15, '#f57f17')
  part(0, 0, 0, 1.15, 1.2, 1.75, '#ff8a1f')
  part(0, 0.12, 0, 1.55, 0.95, 1.55, '#ff9a2e')
  // Face, standing a little proud of the front (z = 0.875) so it never z-fights.
  const fz = 0.875 + 0.03
  const glow = '#ffe04a'
  part(-0.27, 0.7, fz, 0.24, 0.2, 0.06, glow) // eyes
  part(0.27, 0.7, fz, 0.24, 0.2, 0.06, glow)
  part(-0.27, 0.9, fz, 0.12, 0.06, 0.06, glow) // eye tips: a meaner look
  part(0.27, 0.9, fz, 0.12, 0.06, 0.06, glow)
  part(0, 0.52, fz, 0.13, 0.12, 0.06, glow) // nose
  part(0, 0.24, fz, 0.72, 0.18, 0.06, glow) // grin
  part(-0.3, 0.38, fz, 0.12, 0.08, 0.06, glow) // grin corners curling up
  part(0.3, 0.38, fz, 0.12, 0.08, 0.06, glow)
  part(-0.12, 0.33, fz + 0.04, 0.1, 0.09, 0.04, '#9a4a00') // teeth
  part(0.14, 0.24, fz + 0.04, 0.1, 0.09, 0.04, '#9a4a00')
  // Stem and a leaf.
  part(0, 1.15, 0, 0.22, 0.38, 0.22, '#4e6b1f')
  part(0.24, 1.22, 0.06, 0.36, 0.06, 0.22, '#3fa34d')
}
