import { useUI } from '../state/uiStore'
import { StarIcon } from './icons'

export function Toasts() {
  const toasts = useUI((s) => s.toasts)
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <div className="title txt-outline flex items-center gap-2">
            {t.kind === 'badge' && <StarIcon size={28} />}
            {t.title}
          </div>
          {t.text && <div className="text">{t.text}</div>}
        </div>
      ))}
    </div>
  )
}

export function ConfirmDialog() {
  const confirm = useUI((s) => s.confirm)
  const set = useUI((s) => s.set)
  if (!confirm) return null
  const close = () => set({ confirm: null })
  return (
    <div className="overlay-center overlay-dim" style={{ zIndex: 60 }} onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="window-scale">
        <div className="window studs" style={{ width: 'min(560px, calc(100vw - 32px))' }}>
          <div className="window-body flex flex-col items-center gap-5 text-center" style={{ paddingTop: 24 }}>
            <div className="txt-outline text-[44px]">{confirm.title}</div>
            <div className="body-text text-[20px]">{confirm.text}</div>
            <div className="flex gap-4">
              <button type="button" className="btn3d buy-btn bg-dark" onClick={close}>
                <span className="txt-outline">Cancel</span>
              </button>
              <button
                type="button"
                className="btn3d buy-btn bg-green"
                onClick={() => {
                  close()
                  confirm.onYes()
                }}
              >
                <span className="txt-outline">{confirm.yes}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
