/**
 * Canvas drawing helpers for in-world text (signs, boards, labels), styled like
 * the HUD: chunky Lilita One with a thick dark outline.
 */

export const GAME_FONT = '"Lilita One", "Arial Black", Impact, sans-serif'

let fontPromise: Promise<void> | null = null

/** Resolves once the game font can be drawn into canvases. */
export function ensureFont(): Promise<void> {
  if (!fontPromise) {
    fontPromise = (document.fonts?.load(`64px "Lilita One"`) ?? Promise.resolve([]))
      .then(() => undefined)
      .catch(() => undefined)
  }
  return fontPromise
}

const images = new Map<string, Promise<HTMLImageElement | null>>()

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  let p = images.get(src)
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => resolve(null)
      img.src = src
    })
    images.set(src, p)
  }
  return p
}

/** Synchronous access to an image that has already been loaded (else null). */
const loaded = new Map<string, HTMLImageElement>()
export async function preloadImages(srcs: string[]): Promise<void> {
  await Promise.all(
    srcs.map(async (s) => {
      const img = await loadImage(s)
      if (img) loaded.set(s, img)
    }),
  )
}
export function image(src: string): HTMLImageElement | null {
  return loaded.get(src) ?? null
}

export const REBIRTH_ICON = '/icons/rebirth.webp'

export function setFont(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.font = `${Math.round(size)}px ${GAME_FONT}`
}

/** Shrinks `size` until `text` fits in `maxWidth`. */
export function fitSize(ctx: CanvasRenderingContext2D, text: string, size: number, maxWidth: number): number {
  let s = size
  setFont(ctx, s)
  while (s > 8 && ctx.measureText(text).width > maxWidth) {
    s *= 0.92
    setFont(ctx, s)
  }
  return s
}

export function drawOutlined(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  fill: string | CanvasGradient = '#ffffff',
  opts: { stroke?: string; align?: CanvasTextAlign; maxWidth?: number; outline?: number } = {},
): void {
  const s = opts.maxWidth ? fitSize(ctx, text, size, opts.maxWidth) : size
  setFont(ctx, s)
  ctx.textAlign = opts.align ?? 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2
  ctx.lineWidth = s * (opts.outline ?? 0.2)
  ctx.strokeStyle = opts.stroke ?? '#1b1b22'
  ctx.strokeText(text, x, y)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Vertical two-colour gradient for text fills. */
export function vGradient(ctx: CanvasRenderingContext2D, y0: number, y1: number, top: string, bottom: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1)
  g.addColorStop(0, top)
  g.addColorStop(1, bottom)
  return g
}

export type IconKind = 'trophy' | 'gem' | 'pumpkin' | 'lock' | 'target' | 'rebirth' | 'bolt'

/** Small vector icons so labels don't depend on platform emoji fonts. */
export function drawIcon(ctx: CanvasRenderingContext2D, kind: IconKind, cx: number, cy: number, size: number): void {
  const s = size / 2
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineWidth = size * 0.1
  ctx.strokeStyle = '#1b1b22'
  switch (kind) {
    case 'trophy': {
      ctx.fillStyle = '#ffc61a'
      ctx.beginPath()
      ctx.moveTo(cx - s * 0.7, cy - s * 0.8)
      ctx.lineTo(cx + s * 0.7, cy - s * 0.8)
      ctx.quadraticCurveTo(cx + s * 0.7, cy + s * 0.2, cx, cy + s * 0.3)
      ctx.quadraticCurveTo(cx - s * 0.7, cy + s * 0.2, cx - s * 0.7, cy - s * 0.8)
      ctx.closePath()
      ctx.stroke()
      ctx.fill()
      ctx.fillRect(cx - s * 0.15, cy + s * 0.25, s * 0.3, s * 0.35)
      ctx.strokeRect(cx - s * 0.45, cy + s * 0.55, s * 0.9, s * 0.3)
      ctx.fillRect(cx - s * 0.45, cy + s * 0.55, s * 0.9, s * 0.3)
      break
    }
    case 'gem': {
      ctx.fillStyle = '#3ee0b4'
      ctx.beginPath()
      for (let i = 0; i < 6; i += 1) {
        const a = (Math.PI / 3) * i + Math.PI / 6
        ctx.lineTo(cx + Math.cos(a) * s * 0.85, cy + Math.sin(a) * s * 0.85)
      }
      ctx.closePath()
      ctx.stroke()
      ctx.fill()
      ctx.fillStyle = '#c8fff0'
      ctx.beginPath()
      ctx.arc(cx, cy, s * 0.35, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'pumpkin': {
      ctx.fillStyle = '#ff8a1f'
      ctx.beginPath()
      ctx.ellipse(cx, cy + s * 0.1, s * 0.85, s * 0.7, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fill()
      ctx.fillStyle = '#5d3a1a'
      ctx.fillRect(cx - s * 0.1, cy - s * 0.85, s * 0.2, s * 0.35)
      ctx.fillStyle = '#2b1a0a'
      ctx.beginPath()
      ctx.moveTo(cx - s * 0.45, cy - s * 0.05)
      ctx.lineTo(cx - s * 0.2, cy - s * 0.05)
      ctx.lineTo(cx - s * 0.32, cy - s * 0.3)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(cx + s * 0.45, cy - s * 0.05)
      ctx.lineTo(cx + s * 0.2, cy - s * 0.05)
      ctx.lineTo(cx + s * 0.32, cy - s * 0.3)
      ctx.fill()
      break
    }
    case 'lock': {
      ctx.strokeStyle = '#1b1b22'
      ctx.lineWidth = size * 0.16
      ctx.beginPath()
      ctx.arc(cx, cy - s * 0.15, s * 0.4, Math.PI, 0)
      ctx.stroke()
      ctx.strokeStyle = '#c9ced6'
      ctx.lineWidth = size * 0.08
      ctx.stroke()
      ctx.fillStyle = '#ffc61a'
      ctx.lineWidth = size * 0.08
      ctx.strokeStyle = '#1b1b22'
      ctx.fillRect(cx - s * 0.6, cy - s * 0.15, s * 1.2, s * 0.95)
      ctx.strokeRect(cx - s * 0.6, cy - s * 0.15, s * 1.2, s * 0.95)
      break
    }
    case 'target': {
      const rings = ['#ffffff', '#e8323c', '#ffffff', '#e8323c']
      rings.forEach((col, i) => {
        ctx.fillStyle = col
        ctx.beginPath()
        ctx.arc(cx, cy, s * (0.9 - i * 0.22), 0, Math.PI * 2)
        ctx.fill()
      })
      break
    }
    case 'rebirth': {
      const img = image(REBIRTH_ICON)
      if (img) ctx.drawImage(img, cx - s, cy - s, size, size)
      break
    }
    case 'bolt': {
      ctx.fillStyle = '#ffe94a'
      ctx.beginPath()
      ctx.moveTo(cx + s * 0.1, cy - s * 0.9)
      ctx.lineTo(cx - s * 0.5, cy + s * 0.1)
      ctx.lineTo(cx - s * 0.05, cy + s * 0.1)
      ctx.lineTo(cx - s * 0.15, cy + s * 0.9)
      ctx.lineTo(cx + s * 0.5, cy - s * 0.15)
      ctx.lineTo(cx + s * 0.05, cy - s * 0.15)
      ctx.closePath()
      ctx.stroke()
      ctx.fill()
      break
    }
  }
  ctx.restore()
}
