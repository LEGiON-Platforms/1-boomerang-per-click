import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  Vector3,
} from 'three'

/**
 * Sign atlas: many in-world labels drawn into ONE canvas texture and merged into
 * ONE geometry, so all the text in an area costs a single draw call.
 */

export interface SignSpec {
  /** World size of the sign quad. */
  w: number
  h: number
  x: number
  y: number
  z: number
  /** Yaw; 0 faces +Z. */
  rotY: number
  /** Lie flat on the ground, readable from +Z looking down. */
  flat?: boolean
  draw: (ctx: CanvasRenderingContext2D, pw: number, ph: number) => void
}

export interface SignAtlas {
  geometry: BufferGeometry
  texture: CanvasTexture
  canvas: HTMLCanvasElement
}

const PAD = 2

interface Placed {
  spec: SignSpec
  rx: number
  ry: number
  pw: number
  ph: number
}

function pack(specs: SignSpec[], ppu: number, size: number): { placed: Placed[]; height: number } | null {
  const items = specs
    .map((spec) => {
      let pw = Math.ceil(spec.w * ppu)
      let ph = Math.ceil(spec.h * ppu)
      if (pw > size - PAD * 2) {
        const k = (size - PAD * 2) / pw
        pw = Math.floor(pw * k)
        ph = Math.floor(ph * k)
      }
      return { spec, pw, ph, rx: 0, ry: 0 }
    })
    .sort((a, b) => b.ph - a.ph)

  let x = PAD
  let y = PAD
  let shelf = 0
  for (const it of items) {
    if (x + it.pw + PAD > size) {
      x = PAD
      y += shelf + PAD
      shelf = 0
    }
    it.rx = x
    it.ry = y
    x += it.pw + PAD
    shelf = Math.max(shelf, it.ph)
  }
  const height = y + shelf + PAD
  return height <= size ? { placed: items, height } : null
}

const nextPow2 = (v: number) => Math.pow(2, Math.ceil(Math.log2(Math.max(1, v))))

/**
 * Packs and draws `specs`. `ppu` is texture pixels per world unit; it is lowered
 * automatically until everything fits in a `maxSize` square.
 */
export function buildSignAtlas(specs: SignSpec[], ppu: number, maxSize: number, previous?: SignAtlas): SignAtlas {
  let scale = ppu
  let packed = pack(specs, scale, maxSize)
  while (!packed && scale > 2) {
    scale *= 0.85
    packed = pack(specs, scale, maxSize)
  }
  if (!packed) throw new Error('Sign atlas overflow')

  const W = maxSize
  const H = Math.min(maxSize, nextPow2(packed.height))
  const canvas = previous?.canvas ?? document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, W, H)

  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const v = new Vector3()

  for (const p of packed.placed) {
    ctx.save()
    ctx.translate(p.rx, p.ry)
    ctx.beginPath()
    ctx.rect(0, 0, p.pw, p.ph)
    ctx.clip()
    p.spec.draw(ctx, p.pw, p.ph)
    ctx.restore()

    const { w, h, x, y, z, rotY, flat } = p.spec
    const u0 = p.rx / W
    const u1 = (p.rx + p.pw) / W
    const vTop = 1 - p.ry / H
    const vBot = 1 - (p.ry + p.ph) / H
    const base = positions.length / 3
    const corners: [number, number, number, number][] = [
      [-w / 2, -h / 2, u0, vBot],
      [w / 2, -h / 2, u1, vBot],
      [w / 2, h / 2, u1, vTop],
      [-w / 2, h / 2, u0, vTop],
    ]
    const cos = Math.cos(rotY)
    const sin = Math.sin(rotY)
    for (const [lx, ly, u, vv] of corners) {
      if (flat) v.set(lx, 0, -ly)
      else v.set(lx, ly, 0)
      // Rotate about Y.
      const rx = v.x * cos + v.z * sin
      const rz = -v.x * sin + v.z * cos
      positions.push(x + rx, y + v.y, z + rz)
      uvs.push(u, vv)
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()

  let texture = previous?.texture
  if (texture && texture.image === canvas && texture.image.width === W && texture.image.height === H) {
    texture.needsUpdate = true
  } else {
    texture?.dispose()
    texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.minFilter = LinearMipmapLinearFilter
    texture.magFilter = LinearFilter
    texture.anisotropy = 4
  }
  previous?.geometry.dispose()
  return { geometry, texture, canvas }
}
