import type { CSSProperties } from 'react'

const DIGIT = /[0-9]/

/**
 * A number whose digits sit in fixed-width cells (the display font has no
 * tabular figures), so a counter ticking 199 → 200 never shifts or wobbles the
 * text around it.
 */
export function Num({ value, className = '', style }: { value: string; className?: string; style?: CSSProperties }) {
  return (
    <span className={`num ${className}`} style={style}>
      {Array.from(value, (ch, i) => (
        <span key={i} className={DIGIT.test(ch) ? 'd' : ch === '.' || ch === ',' ? 'p' : undefined}>
          {/* A plain space would collapse inside the flex container. */}
          {ch === ' ' ? '\u00a0' : ch}
        </span>
      ))}
    </span>
  )
}
