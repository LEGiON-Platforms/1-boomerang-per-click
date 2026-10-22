import { PET_BY_ID, type PetShape } from '@game/shared'

/**
 * Flat SVG portrait of a pet for inventory cards and egg reveals, drawn from the
 * same shape + colours as the 3D model (no image assets).
 */
const INK = '#1b1b22'

function Eyes({ y = 34, spread = 9 }: { y?: number; spread?: number }) {
  return (
    <g>
      <rect x={32 - spread - 4} y={y} width="7" height="9" rx="2" fill={INK} />
      <rect x={32 + spread - 3} y={y} width="7" height="9" rx="2" fill={INK} />
      <rect x={32 - spread - 2} y={y + 1} width="2.5" height="2.5" fill="#fff" />
      <rect x={32 + spread - 1} y={y + 1} width="2.5" height="2.5" fill="#fff" />
    </g>
  )
}

const art: Record<PetShape, (body: string, accent: string) => React.ReactNode> = {
  bunny: (b, a) => (
    <>
      <rect x="20" y="4" width="8" height="24" rx="4" fill={a} stroke={INK} strokeWidth="3" />
      <rect x="36" y="4" width="8" height="24" rx="4" fill={a} stroke={INK} strokeWidth="3" />
      <rect x="12" y="22" width="40" height="34" rx="12" fill={b} stroke={INK} strokeWidth="3" />
      <Eyes />
      <rect x="29" y="45" width="6" height="4" rx="1" fill={a} />
    </>
  ),
  cat: (b, a) => (
    <>
      <path d="M14 26 L18 8 L28 20 Z M50 26 L46 8 L36 20 Z" fill={b} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <rect x="12" y="18" width="40" height="38" rx="12" fill={b} stroke={INK} strokeWidth="3" />
      <rect x="12" y="44" width="40" height="6" fill={a} />
      <Eyes y={30} />
      <path d="M8 40 h10 M46 40 h10" stroke={INK} strokeWidth="2" />
    </>
  ),
  bear: (b, a) => (
    <>
      <circle cx="16" cy="18" r="8" fill={b} stroke={INK} strokeWidth="3" />
      <circle cx="48" cy="18" r="8" fill={b} stroke={INK} strokeWidth="3" />
      <rect x="10" y="16" width="44" height="40" rx="14" fill={b} stroke={INK} strokeWidth="3" />
      <ellipse cx="32" cy="45" rx="10" ry="7" fill="#fff" stroke={INK} strokeWidth="2" />
      <rect x="28" y="40" width="8" height="5" rx="2" fill={INK} />
      <Eyes y={29} />
      <rect x="10" y="52" width="44" height="5" fill={a} />
    </>
  ),
  golem: (b, a) => (
    <>
      <rect x="8" y="12" width="48" height="44" rx="5" fill={b} stroke={INK} strokeWidth="3" />
      <rect x="18" y="28" width="9" height="6" fill={a} />
      <rect x="37" y="28" width="9" height="6" fill={a} />
      <rect x="24" y="42" width="16" height="6" fill={INK} opacity="0.6" />
      <path d="M8 22 h48" stroke={INK} strokeWidth="2" opacity="0.4" />
    </>
  ),
  bird: (b, a) => (
    <>
      <ellipse cx="32" cy="36" rx="22" ry="22" fill={b} stroke={INK} strokeWidth="3" />
      <path d="M10 38 Q2 46 12 50 Z M54 38 Q62 46 52 50 Z" fill={a} stroke={INK} strokeWidth="2" />
      <path d="M28 40 L36 40 L32 48 Z" fill={a} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M30 12 L32 4 L35 12" fill={a} stroke={INK} strokeWidth="2" />
      <Eyes y={28} />
    </>
  ),
  dragon: (b, a) => (
    <>
      <path d="M18 18 L14 4 L24 14 Z M46 18 L50 4 L40 14 Z" fill={a} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="12" y="14" width="40" height="40" rx="10" fill={b} stroke={INK} strokeWidth="3" />
      <rect x="22" y="40" width="20" height="12" rx="4" fill={b} stroke={INK} strokeWidth="2" />
      <circle cx="27" cy="45" r="1.6" fill={INK} />
      <circle cx="37" cy="45" r="1.6" fill={INK} />
      <Eyes y={26} />
    </>
  ),
  ghost: (b, a) => (
    <>
      <path d="M12 56 V30 a20 20 0 0 1 40 0 V56 l-7 -5 -6 5 -6 -5 -6 5 -6 -5 z" fill={b} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <rect x="12" y="44" width="40" height="5" fill={a} />
      <Eyes y={28} spread={8} />
    </>
  ),
}

export function PetPortrait({ petId, golden = false, size = 72 }: { petId: string; golden?: boolean; size?: number }) {
  const def = PET_BY_ID[petId]
  if (!def) return null
  const body = golden ? '#ffd23f' : def.color
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} style={golden ? { filter: 'drop-shadow(0 0 6px #ffd23f)' } : undefined}>
      {art[def.shape](body, def.accent)}
    </svg>
  )
}
