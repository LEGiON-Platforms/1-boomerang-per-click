import type { PetShape } from '@game/shared'
import { BoxGeometry, type BufferGeometry, ConeGeometry, CylinderGeometry, Float32BufferAttribute, SphereGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Low-poly pet bodies. Each vertex carries a `part` attribute read by the
 * two-tone material: 0 = body colour, 1 = accent colour, 2 = black (eyes), 3 = white.
 * Built facing +Z, feet at y = 0, about one unit tall.
 */

const BODY = 0
const ACCENT = 1
const BLACK = 2
const WHITE = 3

class PetBuilder {
  private parts: BufferGeometry[] = []

  private add(g: BufferGeometry, part: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): this {
    g.deleteAttribute('uv')
    const geo = g.index ? g.toNonIndexed() : g
    if (geo !== g) g.dispose()
    if (rx) geo.rotateX(rx)
    if (ry) geo.rotateY(ry)
    if (rz) geo.rotateZ(rz)
    geo.translate(x, y, z)
    geo.setAttribute('part', new Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count).fill(part), 1))
    this.parts.push(geo)
    return this
  }

  box(part: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0, rz = 0): this {
    return this.add(new BoxGeometry(sx, sy, sz), part, x, y, z, rx, ry, rz)
  }

  sphere(part: number, x: number, y: number, z: number, r: number, sy = 1): this {
    const g = new SphereGeometry(r, 8, 6)
    g.scale(1, sy, 1)
    return this.add(g, part, x, y, z)
  }

  cone(part: number, x: number, y: number, z: number, r: number, h: number, rx = 0, rz = 0): this {
    return this.add(new ConeGeometry(r, h, 4), part, x, y, z, rx, 0, rz)
  }

  cyl(part: number, x: number, y: number, z: number, r: number, h: number, rTop = r): this {
    return this.add(new CylinderGeometry(rTop, r, h, 10), part, x, y, z)
  }

  eyes(y: number, z: number, spread = 0.14, size = 0.09): this {
    this.box(BLACK, -spread, y, z, size, size * 1.3, 0.04)
    this.box(BLACK, spread, y, z, size, size * 1.3, 0.04)
    this.box(WHITE, -spread + 0.02, y + 0.03, z + 0.02, 0.03, 0.03, 0.02)
    return this.box(WHITE, spread + 0.02, y + 0.03, z + 0.02, 0.03, 0.03, 0.02)
  }

  build(): BufferGeometry {
    const g = mergeGeometries(this.parts, false)!
    for (const p of this.parts) p.dispose()
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return g
  }
}

const builders: Record<PetShape, () => BufferGeometry> = {
  bunny: () =>
    new PetBuilder()
      .box(BODY, 0, 0.3, 0, 0.55, 0.5, 0.5)
      .box(BODY, 0, 0.72, 0.05, 0.5, 0.42, 0.45)
      .box(ACCENT, -0.13, 1.1, 0.02, 0.12, 0.42, 0.08)
      .box(ACCENT, 0.13, 1.1, 0.02, 0.12, 0.42, 0.08)
      .box(WHITE, 0, 0.3, -0.29, 0.16, 0.16, 0.12)
      .box(ACCENT, 0, 0.62, 0.29, 0.08, 0.06, 0.04)
      .eyes(0.76, 0.28)
      .build(),
  cat: () =>
    new PetBuilder()
      .box(BODY, 0, 0.3, -0.05, 0.5, 0.45, 0.65)
      .box(BODY, 0, 0.7, 0.18, 0.5, 0.42, 0.42)
      .cone(BODY, -0.15, 0.98, 0.18, 0.11, 0.2)
      .cone(BODY, 0.15, 0.98, 0.18, 0.11, 0.2)
      .box(ACCENT, 0, 0.55, -0.45, 0.1, 0.1, 0.45, -0.6)
      .box(ACCENT, 0, 0.5, 0.18, 0.52, 0.08, 0.44)
      .eyes(0.74, 0.4)
      .build(),
  bear: () =>
    new PetBuilder()
      .box(BODY, 0, 0.32, 0, 0.62, 0.58, 0.5)
      .box(ACCENT, 0, 0.3, 0.26, 0.4, 0.36, 0.04)
      .box(BODY, 0, 0.82, 0.02, 0.55, 0.48, 0.48)
      .box(BODY, -0.22, 1.1, 0.02, 0.16, 0.16, 0.12)
      .box(BODY, 0.22, 1.1, 0.02, 0.16, 0.16, 0.12)
      .box(WHITE, 0, 0.74, 0.27, 0.2, 0.14, 0.06)
      .box(BLACK, 0, 0.78, 0.31, 0.08, 0.05, 0.03)
      .box(ACCENT, -0.38, 0.4, 0, 0.14, 0.4, 0.16)
      .box(ACCENT, 0.38, 0.4, 0, 0.14, 0.4, 0.16)
      .eyes(0.88, 0.27, 0.13)
      .build(),
  golem: () =>
    new PetBuilder()
      .box(BODY, 0, 0.42, 0, 0.75, 0.62, 0.5)
      .box(BODY, 0, 0.9, 0.03, 0.42, 0.34, 0.38)
      .box(BODY, -0.48, 0.38, 0, 0.2, 0.55, 0.24)
      .box(BODY, 0.48, 0.38, 0, 0.2, 0.55, 0.24)
      .box(ACCENT, 0, 0.45, 0.26, 0.24, 0.24, 0.04)
      .box(ACCENT, -0.1, 0.92, 0.23, 0.08, 0.06, 0.03)
      .box(ACCENT, 0.1, 0.92, 0.23, 0.08, 0.06, 0.03)
      .box(BODY, -0.18, 0.06, 0, 0.2, 0.14, 0.24)
      .box(BODY, 0.18, 0.06, 0, 0.2, 0.14, 0.24)
      .build(),
  bird: () =>
    new PetBuilder()
      .sphere(BODY, 0, 0.5, 0, 0.32, 1.15)
      .box(ACCENT, -0.32, 0.5, -0.04, 0.08, 0.3, 0.36, 0, 0, 0.3)
      .box(ACCENT, 0.32, 0.5, -0.04, 0.08, 0.3, 0.36, 0, 0, -0.3)
      .cone(ACCENT, 0, 0.58, 0.36, 0.07, 0.16, Math.PI / 2)
      .box(ACCENT, 0, 0.9, -0.05, 0.06, 0.16, 0.16)
      .eyes(0.66, 0.29, 0.12, 0.07)
      .build(),
  dragon: () =>
    new PetBuilder()
      .box(BODY, 0, 0.35, -0.05, 0.5, 0.45, 0.65)
      .box(BODY, 0, 0.78, 0.2, 0.42, 0.38, 0.45)
      .box(BODY, 0, 0.7, 0.48, 0.28, 0.2, 0.16)
      .cone(ACCENT, -0.13, 1.04, 0.15, 0.06, 0.2)
      .cone(ACCENT, 0.13, 1.04, 0.15, 0.06, 0.2)
      .box(ACCENT, -0.42, 0.62, -0.05, 0.36, 0.06, 0.4, 0, 0, 0.5)
      .box(ACCENT, 0.42, 0.62, -0.05, 0.36, 0.06, 0.4, 0, 0, -0.5)
      .box(BODY, 0, 0.32, -0.5, 0.12, 0.12, 0.4, 0.4)
      .eyes(0.84, 0.43, 0.12, 0.08)
      .build(),
  ghost: () =>
    new PetBuilder()
      .cyl(BODY, 0, 0.42, 0, 0.36, 0.64, 0.34)
      .sphere(BODY, 0, 0.74, 0, 0.34)
      .box(ACCENT, 0, 0.5, 0, 0.74, 0.1, 0.74)
      .box(ACCENT, 0.24, 0.42, 0.3, 0.12, 0.22, 0.06)
      .eyes(0.8, 0.31, 0.12, 0.1)
      .build(),
}

const cache = new Map<PetShape, BufferGeometry>()

export function getPetGeometry(shape: PetShape): BufferGeometry {
  let g = cache.get(shape)
  if (!g) {
    g = builders[shape]()
    cache.set(shape, g)
  }
  return g
}

export const PET_SHAPES: PetShape[] = ['bunny', 'cat', 'bear', 'golem', 'bird', 'dragon', 'ghost']
