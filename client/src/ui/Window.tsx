import type { ReactNode } from 'react'

import { playSfx } from '../audio/sfx'
import { CloseIcon } from './icons'

interface WindowProps {
  title: string
  onClose: () => void
  children: ReactNode
  width?: number
  footer?: ReactNode
  tabs?: ReactNode
}

/** The studded, dark game window with a big outlined title and a pink close button. */
export function Window({ title, onClose, children, width = 880, footer, tabs }: WindowProps) {
  return (
    <div
      className="overlay-center overlay-dim"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="window-scale">
        <div className="window studs" style={{ width: `min(${width}px, calc(100vw - 32px))` }}>
          <div className="window-title txt-outline">{title}</div>
          <button
            type="button"
            className="btn3d window-close"
            aria-label="Close"
            onClick={() => {
              playSfx('click')
              onClose()
            }}
          >
            <CloseIcon size={44} />
          </button>
          {tabs && <div className="window-tabs">{tabs}</div>}
          <div className="window-body" style={tabs ? { paddingTop: 14 } : undefined}>
            {children}
          </div>
          {footer && <div className="px-5 pb-4">{footer}</div>}
        </div>
      </div>
    </div>
  )
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`btn3d tab-btn ${o.id === value ? 'bg-cyan' : 'bg-dark'}`}
          onClick={() => {
            playSfx('click')
            onChange(o.id)
          }}
        >
          <span className="txt-outline">{o.label}</span>
        </button>
      ))}
    </>
  )
}
