import { C2S, LIKE_GOAL } from '@game/shared'
import { useState } from 'react'

import { playSfx } from '../../audio/sfx'
import { send } from '../../net/connection'
import { useGame } from '../../state/gameStore'
import { ui } from '../../state/uiStore'
import { CodeIcon } from '../icons'
import { Window } from '../Window'

export function CodesPanel() {
  const used = useGame((s) => s.data?.codes ?? [])
  const [code, setCode] = useState('')
  const redeem = () => {
    if (!code.trim()) return
    playSfx('click')
    send(C2S.redeemCode, { code: code.trim() })
    setCode('')
  }
  return (
    <Window title="Codes" onClose={() => ui().closePanel()} width={640}>
      <div className="flex flex-col items-center gap-4">
        <CodeIcon size={90} />
        <div className="flex w-full gap-2">
          <input
            value={code}
            autoFocus
            maxLength={24}
            placeholder="Enter code"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && redeem()}
            className="body-text h-[62px] flex-1 rounded-xl border-4 border-[#1b1b22] bg-[#111218] px-4 text-[24px] uppercase text-white"
          />
          <button type="button" className="btn3d buy-btn bg-green" onClick={redeem}>
            <span className="txt-outline">Redeem</span>
          </button>
        </div>
        <div className="body-text text-center text-[16px]">
          Like goal {LIKE_GOAL.current}/{LIKE_GOAL.target}: try <b>{LIKE_GOAL.code}</b> — and <b>RELEASE</b> while it lasts!
        </div>
        {used.length > 0 && <div className="body-text text-[14px] opacity-70">Redeemed: {used.join(', ')}</div>}
      </div>
    </Window>
  )
}
