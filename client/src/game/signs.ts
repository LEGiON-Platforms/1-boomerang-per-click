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
 * Sign atlas: many in-world labels drawn into a few canvas textures (pages), each
 * with ONE merged geometry, so all the text in an area costs a draw call per page.
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

/** One page of signs: a canvas texture and the merged quads that sample it. */
export interface SignPage {
  geometry: BufferGeometry
  texture: CanvasTexture
}

const PAD = 2
/** Pages per atlas at most; past this the resolution steps down instead. */
const MAX_PAGES = 6

interface Item {
  spec: SignSpec
  rx: number
  ry: number
  pw: number
  ph: number
}

function measure(specs: SignSpec[], ppu: number, size: number): Item[] {
  return specs
    .map((spec) => {
      let pw = Math.ceil(spec.w * ppu)
      let ph = Math.ceil(spec.h * ppu)
      // A sign wider (or taller) than a page is drawn at the largest size that fits.
      const k = Math.min(1, (size - PAD * 2) / pw, (size - PAD * 2) / ph)
      pw = Math.floor(pw * k)
      ph = Math.floor(ph * k)
      return { spec, pw, ph, rx: 0, ry: 0 }
    })
    .sort((a, b) => b.ph - a.ph)
}

/** Shelf-packs items into pages of `size`²; items that don't fit go to the next page. */
function packPages(items: Item[], size: number): { placed: Item[]; height: number }[] {
  const pages: { placed: Item[]; height: number }[] = []
  let rest = items
  while (rest.length) {
    const placed: Item[] = []
    const left: Item[] = []
    let x = PAD
    let y = PAD
    let shelf = 0
    for (const it of rest) {
      if (x + it.pw + PAD > size) {
        x = PAD
        y += shelf + PAD
        shelf = 0
      }
      if (y + it.ph + PAD > size) {
        left.push(it)
        continue
      }
      it.rx = x
      it.ry = y
      x += it.pw + PAD
      shelf = Math.max(shelf, it.ph)
      placed.push(it)
    }
    pages.push({ placed, height: y + shelf + PAD })
    rest = left
  }
  return pages
}

const nextPow2 = (v: number) => Math.pow(2, Math.ceil(Math.log2(Math.max(1, v))))

function drawPage(placed: Item[], width: number, height: number): SignPage {
  const W = width
  const H = Math.min(width, nextPow2(height))
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const v = new Vector3()

  for (const p of placed) {
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

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearMipmapLinearFilter
  texture.magFilter = LinearFilter
  // Keeps text sharp at grazing angles (floor decals, signs seen side-on).
  texture.anisotropy = 8
  return { geometry, texture }
}

/**
 * Packs and draws `specs` at `ppu` texture pixels per world unit onto as many
 * `pageSize`² pages as they need (each page one draw call). Splitting into pages
 * keeps text sharp while every texture stays within the preset's size limit; past
 * MAX_PAGES the resolution steps down instead.
 */
export function buildSignPages(specs: SignSpec[], ppu: number, pageSize: number): SignPage[] {
  let scale = ppu
  let pages = packPages(measure(specs, scale, pageSize), pageSize)
  while (pages.length > MAX_PAGES && scale > 4) {
    scale *= 0.85
    pages = packPages(measure(specs, scale, pageSize), pageSize)
  }
  return pages.map((p) => drawPage(p.placed, pageSize, p.height))
}

export function disposeSignPages(pages: SignPage[]): void {
  for (const p of pages) {
    p.geometry.dispose()
    p.texture.dispose()
  }
}
