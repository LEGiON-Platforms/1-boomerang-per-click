/**
 * HUD icons as inline SVG — no image downloads, no dependence on platform emoji.
 * The rebirth icon is the provided artwork (public/icons/rebirth.webp).
 */

import { type CSSProperties, useId } from 'react'

import { type BoomerangLook, boomerangLook, svgShape } from '../game/boomerangShapes'

const STROKE = '#1b1b22'

interface IconProps {
  size?: number | string
  className?: string
  style?: CSSProperties
}

const box = (size: number | string = 32) => ({ width: size, height: size })

export function RebirthIcon({ size = 32, className, style }: IconProps) {
  return <img src="/icons/rebirth.webp" alt="" draggable={false} className={className} style={{ ...box(size), ...style }} />
}

export function TrophyIcon({ size, className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={{ ...box(size), ...style }} className={className}>
      <path d="M14 8h36v10c0 13-8 22-18 22S14 31 14 18z" fill="#ffc61a" stroke={STROKE} strokeWidth="4" strokeLinejoin="round" />
      <path d="M14 14H6c0 9 4 14 10 15M50 14h8c0 9-4 14-10 15" fill="none" stroke={STROKE} strokeWidth="4" />
      <path d="M14 14H6c0 9 4 14 10 15M50 14h8c0 9-4 14-10 15" fill="none" stroke="#ffc61a" strokeWidth="2" />
      <rect x="27" y="39" width="10" height="10" fill="#e8a400" stroke={STROKE} strokeWidth="4" />
      <rect x="17" y="48" width="30" height="9" rx="2" fill="#ffc61a" stroke={STROKE} strokeWidth="4" />
      <path d="M22 13v6c0 6 3 11 7 13" fill="none" stroke="#fff3b0" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export function PumpkinIcon({ size, className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={{ ...box(size), ...style }} className={className}>
      <path d="M32 10c4-6 9-6 11-4" fill="none" stroke="#3d7a22" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="32" cy="37" rx="26" ry="21" fill="#ff8a1f" stroke={STROKE} strokeWidth="4" />
      <path d="M32 16c-8 6-8 36 0 42M32 16c8 6 8 36 0 42" fill="none" stroke="#e06a00" strokeWidth="3" />
      <path d="M17 31l7-6 4 8zM47 31l-7-6-4 8z" fill="#2b1a0a" />
      <path d="M18 42c5 6 23 6 28 0l-4 6-4-3-4 4-4-4-4 4-4-3z" fill="#2b1a0a" />
    </svg>
  )
}

export function PowerBurstIcon({ size, className, style }: IconProps) {
  const pts = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2
    const r = i % 2 === 0 ? 30 : 17
    return `${32 + Math.cos(a) * r},${32 + Math.sin(a) * r}`
  }).join(' ')
  return (
    <svg viewBox="0 0 64 64" style={{ ...box(size), ...style }} className={className}>
      <polygon points={pts} fill="#ff3b2f" stroke={STROKE} strokeWidth="3" strokeLinejoin="round" />
      <polygon points={pts} fill="#ffd21f" transform="translate(32 32) scale(0.6) translate(-32 -32)" />
    </svg>
  )
}

export function TrailsIcon({ size, className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={{ ...box(size), ...style }} className={className}>
      <path d="M8 44c10-30 40-34 50-20" fill="none" stroke={STROKE} strokeWidth="12" strokeLinecap="round" />
      <path d="M8 44c10-30 40-34 50-20" fill="none" stroke="#ff7a1f" strokeWidth="7" strokeLinecap="round" />
      <path d="M14 46c8-18 30-24 40-14" fill="none" stroke="#ffd21f" strokeWidth="4" strokeLinecap="round" />
      <path d="M40 30l14-8 4 10-12 10z" fill="#e8323c" stroke={STROKE} strokeWidth="3" strokeLinejoin="round" />
    </svg>
  )
}

export function ShopIcon({ size, className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={{ ...box(size), ...style }} className={className}>
      <path d="M8 24l24-12 24 12-24 12z" fill="#ff5a6e" stroke={STROKE} strokeWidth="4" strokeLinejoin="round" />
      <path d="M8 24v22l24 12V36zM56 24v22L32 58V36z" fill="#d61f3c" stroke={STROKE} strokeWidth="4" strokeLinejoin="round" />
      <path d="M20 18l24 12" stroke="#ffd1d8" strokeWidth="4" />
    </svg>
  )
}

export function BackpackIcon({ size, className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={{ ...box(size), ...style }} className={className}>
      <path d="M24 14c0-8 16-8 16 0" fill="none" stroke={STROKE} strokeWidth="5" />
      <rect x="12" y="14" width="40" height="44" rx="12" fill="#a8693a" stroke={STROKE} strokeWidth="4" />
      <rect x="20" y="34" width="24" height="16" rx="5" fill="#8a5530" stroke={STROKE} strokeWidth="3" />
      <path d="M22 26c4 4 16 4 20 0" fill="none" stroke="#5d3a1a" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function GiftIcon({ size, className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={{ ...box(size), ...style }} className={className}>
      <rect x="8" y="26" width="48" height="32" rx="3" fill="#b04dff" stroke={STROKE} strokeWidth="4" />
      <rect x="5" y="18" width="54" height="11" rx="3" fill="#c46bff" stroke={STROKE} strokeWidth="4" />
      <rect x="28" y="18" width="8" height="40" fill="#ffd21f" stroke={STROKE} strokeWidth="3" />
      <path d="M32 18c-6-12-18-8-12-2 3 3 12 2 12 2zM32 18c6-12 18-8 12-2-3 3-12 2-12 2z" fill="#ffd21f" stroke={STROKE} strokeWidth="3" />
    </svg>
  )
}

export function TimerIcon({ size, className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={{ ...box(size), ...style }} className={className}>
      <rect x="26" y="4" width="12" height="7" rx="2" fill="#3da5ff" stroke={STROKE} strokeWidth="3" />
      <circle cx="32" cy="36" r="23" fill="#e9f5ff" stroke={STROKE} strokeWidth="4" />
      <circle cx="32" cy="36" r="17" fill="#3da5ff" opacity="0.25" />
      <path d="M32 36V22M32 36l9 6" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export function CalendarIcon({ size, className, style, day = 31 }: IconProps & { day?: number }) {
  return (
    <svg viewBox="0 0 64 64" style={{ ...box(size), ...style }} className={className}>
      <rect x="6" y="10" width="52" height="48" rx="6" fill="#ffffff" stroke={STROKE} strokeWidth="4" />
      <rect x="6" y="10" width="52" height="14" rx="6" fill="#e8323c" stroke={STROKE} strokeWidth="4" />
      <text x="32" y="51" textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize="24" fill={STROKE}>
        {day}
      </text>
    </svg>
  )
}

export function CodeIcon({ size, className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={{ ...box(size), ...style }} className={className}>
      <path d="M6 18h52v10a5 5 0 000 10v10H6V38a5 5 0 000-10z" fill="#5fd3ff" stroke={STROKE} strokeWidth="4" strokeLinejoin="round" />
      <text x="32" y="38" textAnchor="middle" fontFamily="Lilita One, sans-serif" fontSize="15" fill={STROKE}>
        CODE
      </text>
    </svg>
  )
}

export function FriendsIcon({ size, className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={{ ...box(size), ...style }} className={className}>
      <circle cx="26" cy="32" r="20" fill="#ffd21f" stroke={STROKE} strokeWidth="4" />
      <circle cx="19" cy="28" r="4" fill={STROKE} />
      <circle cx="33" cy="28" r="4" fill={STROKE} />
      <path d="M17 38c5 6 13 6 18 0" fill="none" stroke={STROKE} strokeWidth="4" strokeLinecap="round" />
      <path d="M50 36v20M40 46h20" stroke={STROKE} strokeWidth="10" strokeLinecap="round" />
      <path d="M50 36v20M40 46h20" stroke="#2ee66b" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}

/** An 8-tooth gear outline (one polygon, so one gradient shades the whole gear). */
const GEAR_POINTS = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4
  return [
    [a - 0.27, 20.5],
    [a - 0.15, 29],
    [a + 0.15, 29],
    [a + 0.27, 20.5],
  ]
    .map(([t, r]) => `${(32 + Math.sin(t) * r).toFixed(2)},${(32 - Math.cos(t) * r).toFixed(2)}`)
    .join(' ')
}).join(' ')

export function GearIcon({ size, className, style }: IconProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg viewBox="0 0 64 64" style={{ ...box(size), ...style }} className={className}>
      <defs>
        <linearGradient id={`${uid}m`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#d3d9e3" />
          <stop offset="1" stopColor="#8a94a6" />
        </linearGradient>
        <radialGradient id={`${uid}j`} cx="0.38" cy="0.34" r="0.75">
          <stop offset="0" stopColor="#b8f6ff" />
          <stop offset="0.55" stopColor="#36b3ff" />
          <stop offset="1" stopColor="#1652d9" />
        </radialGradient>
      </defs>
      <polygon points={GEAR_POINTS} fill={`url(#${uid}m)`} stroke={STROKE} strokeWidth="4" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="13.5" fill="none" stroke="#7b8598" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="8.5" fill={`url(#${uid}j)`} stroke={STROKE} strokeWidth="3.5" />
      <circle cx="29.5" cy="29.5" r="2.4" fill="#ffffff" opacity="0.85" />
      <path d="M17.5 23.5a16.5 16.5 0 0 1 9-8.5" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export function LockIcon({ size, className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={{ ...box(size), ...style }} className={className}>
      <path d="M20 30V20a12 12 0 0124 0v10" fill="none" stroke={STROKE} strokeWidth="9" />
      <path d="M20 30V20a12 12 0 0124 0v10" fill="none" stroke="#c9ced6" strokeWidth="4" />
      <rect x="12" y="28" width="40" height="30" rx="5" fill="#ffc61a" stroke={STROKE} strokeWidth="4" />
    </svg>
  )
}

const RAINBOW = ['#ff4d4d', '#ffb31a', '#ffe94a', '#4dff7a', '#36d9ff', '#5b6bff', '#d24dff']

const hexagon = (x: number, y: number, r: number) =>
  Array.from({ length: 6 }, (_, k) => {
    const a = Math.PI / 6 + (k * Math.PI) / 3
    return `${(x + Math.cos(a) * r).toFixed(3)},${(y + Math.sin(a) * r).toFixed(3)}`
  }).join(' ')

/**
 * A boomerang drawn from the same outline as its 3D model, with its pattern,
 * shading, accent rim and gem. Glowing tiers get a gradient halo (no CSS filter:
 * the shop lists sixty of these).
 */
export function BoomerangIcon({ size, className, style, look = boomerangLook(13) }: IconProps & { look?: BoomerangLook }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const svg = svgShape(look.shape)
  const ref = (k: string) => `url(#${uid}${k})`
  const p = look.pattern
  return (
    <svg viewBox={svg.viewBox} style={{ ...box(size), ...style }} className={className}>
      <defs>
        <clipPath id={`${uid}c`}>
          <path d={svg.path} />
        </clipPath>
        <linearGradient id={`${uid}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
        {look.glow >= 0.3 && (
          <radialGradient id={`${uid}h`}>
            <stop offset="0.25" stopColor={look.color} stopOpacity={Math.min(0.75, look.glow * 0.7)} />
            <stop offset="1" stopColor={look.color} stopOpacity="0" />
          </radialGradient>
        )}
        {p === 'stripes' && (
          <pattern id={`${uid}p`} width="0.353" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(32)">
            <rect width="0.141" height="4" fill={look.accent} />
          </pattern>
        )}
        {p === 'grain' && (
          <pattern id={`${uid}p`} width="0.185" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
            <rect width="0.045" height="4" fill="#000" fillOpacity="0.16" />
          </pattern>
        )}
        {p === 'rainbow' && (
          <linearGradient id={`${uid}r`} x1="0" y1="0" x2="1" y2="1">
            {RAINBOW.map((c, i) => (
              <stop key={c} offset={i / (RAINBOW.length - 1)} stopColor={c} />
            ))}
          </linearGradient>
        )}
      </defs>
      {look.glow >= 0.3 && <circle cx={svg.centerX} cy={svg.centerY} r="1.05" fill={ref('h')} />}
      <path d={svg.path} fill={p === 'rainbow' ? ref('r') : look.color} />
      <g clipPath={ref('c')}>
        {p === 'tips' && svg.tips.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={look.accent} />)}
        {p === 'bands' &&
          svg.tips.map(([x, y, r], i) => (
            <g key={i} fill="none" stroke={look.accent} strokeWidth="0.07">
              <circle cx={x} cy={y} r={r - 0.02} />
              <circle cx={x} cy={y} r={r + 0.11} />
            </g>
          ))}
        {(p === 'stripes' || p === 'grain') && <rect x="-2" y="-2" width="4" height="4" fill={ref('p')} />}
        {p === 'core' && <circle cx={svg.core[0]} cy={svg.core[1]} r={svg.core[2]} fill={look.accent} />}
        {p === 'split' && <rect x={svg.centerX} y="-2" width="4" height="4" fill={look.accent} />}
        {/* Accent rim: only the inner half of this stroke survives the clip. */}
        <path d={svg.path} fill={ref('s')} stroke={look.accent} strokeWidth="0.1" strokeOpacity="0.8" />
      </g>
      <path d={svg.path} fill="none" stroke={STROKE} strokeWidth="0.075" strokeLinejoin="round" />
      {look.gem && (
        <g stroke={STROKE} strokeWidth="0.03" strokeLinejoin="round">
          <polygon points={hexagon(svg.gem[0], svg.gem[1], svg.gem[2])} fill={look.accent} />
          <polygon points={hexagon(svg.gem[0], svg.gem[1], svg.gem[2])} fill="#fff" fillOpacity="0.35" stroke="none" />
          <polygon
            points={hexagon(svg.gem[0] - svg.gem[2] * 0.3, svg.gem[1] - svg.gem[2] * 0.3, svg.gem[2] * 0.35)}
            fill="#fff"
            fillOpacity="0.8"
            stroke="none"
          />
        </g>
      )}
    </svg>
  )
}

export function HandIcon({ size, className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={{ ...box(size), ...style }} className={className}>
      <path
        d="M24 30V12a5 5 0 0110 0v14l12 2a6 6 0 015 7l-3 15c-1 6-6 10-12 10h-5c-5 0-8-2-11-6l-8-11a5 5 0 017-7z"
        fill="#ffffff"
        stroke={STROKE}
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CloseIcon({ size, className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={{ ...box(size), ...style }} className={className}>
      <path d="M16 16l32 32M48 16L16 48" stroke={STROKE} strokeWidth="14" strokeLinecap="round" />
      <path d="M16 16l32 32M48 16L16 48" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" />
    </svg>
  )
}

export function StarIcon({ size, className, style, color = '#ffd21f' }: IconProps & { color?: string }) {
  return (
    <svg viewBox="0 0 64 64" style={{ ...box(size), ...style }} className={className}>
      <path d="M32 4l8 18 20 2-15 13 5 20-18-11-18 11 5-20L4 24l20-2z" fill={color} stroke={STROKE} strokeWidth="4" strokeLinejoin="round" />
    </svg>
  )
}

export function TargetIcon({ size, className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={{ ...box(size), ...style }} className={className}>
      <circle cx="32" cy="32" r="27" fill="#ffffff" stroke={STROKE} strokeWidth="4" />
      <circle cx="32" cy="32" r="19" fill="#e8323c" />
      <circle cx="32" cy="32" r="12" fill="#ffffff" />
      <circle cx="32" cy="32" r="6" fill="#e8323c" />
    </svg>
  )
}

export function PlayersIcon({ size, className, style }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" style={{ ...box(size), ...style }} className={className}>
      <circle cx="22" cy="22" r="10" fill="#ffd9a8" stroke={STROKE} strokeWidth="4" />
      <path d="M6 54c0-12 8-18 16-18s16 6 16 18z" fill="#2f8cff" stroke={STROKE} strokeWidth="4" strokeLinejoin="round" />
      <circle cx="44" cy="20" r="9" fill="#ffd9a8" stroke={STROKE} strokeWidth="4" />
      <path d="M34 36c3-2 6-3 10-3 8 0 14 6 14 17H40" fill="#2ee66b" stroke={STROKE} strokeWidth="4" strokeLinejoin="round" />
    </svg>
  )
}
