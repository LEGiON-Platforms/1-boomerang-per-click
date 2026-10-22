import { C2S, sanitizeName } from '@game/shared'
import { useState } from 'react'

import { useBloxitySession as useBloxity } from '../../bloxity/session'
import { send } from '../../net/connection'
import { saveName } from '../../net/identity'
import { useGame } from '../../state/gameStore'
import { type Preset, useQuality } from '../../state/qualityStore'
import { ui } from '../../state/uiStore'
import { Window } from '../Window'

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="list-row justify-between">
      <span className="txt-outline text-[26px]">{label}</span>
      <button type="button" className={`btn3d buy-btn ${value ? 'bg-green' : 'bg-dark'}`} onClick={() => onChange(!value)}>
        <span className="txt-outline">{value ? 'ON' : 'OFF'}</span>
      </button>
    </div>
  )
}

export function SettingsPanel() {
  const q = useQuality()
  const data = useGame((s) => s.data)
  const roomId = useGame((s) => s.roomId)
  const { identity, isLoggedIn, login, logout, status } = useBloxity()
  const [name, setName] = useState(data?.name ?? '')
  const presets: (Preset | 'AUTO')[] = ['AUTO', 'LOW', 'MEDIUM', 'HIGH']
  const current = q.auto ? 'AUTO' : q.preset

  return (
    <Window title="Settings" onClose={() => ui().closePanel()} width={760}>
      <div className="list-row flex-wrap justify-between gap-3">
        <span className="txt-outline text-[26px]">Graphics</span>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              className={`btn3d tab-btn ${current === p ? 'bg-cyan' : 'bg-dark'}`}
              onClick={() => (p === 'AUTO' ? q.setAuto() : q.setPreset(p))}
            >
              <span className="txt-outline">{p === 'AUTO' ? `Auto (${q.preset})` : p}</span>
            </button>
          ))}
        </div>
      </div>
      <Toggle label="Music" value={q.music} onChange={q.setMusic} />
      <Toggle label="Sound Effects" value={q.sfx} onChange={q.setSfx} />
      <Toggle label="Hide other players' pets" value={q.hideOtherPets} onChange={q.setHideOtherPets} />
      {import.meta.env.DEV && <Toggle label="Performance overlay (dev)" value={q.showPerf} onChange={q.setShowPerf} />}

      <div className="list-row flex-wrap justify-between gap-3">
        <span className="txt-outline text-[26px]">Display name</span>
        <div className="flex gap-2">
          <input
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            className="body-text h-[54px] w-[220px] rounded-lg border-4 border-[#1b1b22] bg-[#111218] px-3 text-[20px] text-white"
          />
          <button
            type="button"
            className="btn3d buy-btn bg-green"
            onClick={() => {
              const clean = sanitizeName(name)
              if (!clean) return ui().toast('Names need 3–20 letters or numbers', 'error')
              saveName(clean)
              send(C2S.setName, { name: clean })
              ui().toast('Name updated!', 'success')
            }}
          >
            <span className="txt-outline">Save</span>
          </button>
        </div>
      </div>

      <div className="list-row flex-wrap justify-between gap-3">
        <div>
          <div className="txt-outline text-[26px]">Bloxity account</div>
          <div className="body-text text-[16px]">
            {isLoggedIn ? `Signed in as ${identity?.displayName || identity?.username}` : 'Playing as guest — your progress is saved on this device.'}
          </div>
        </div>
        {isLoggedIn ? (
          <button type="button" className="btn3d buy-btn bg-dark" onClick={logout}>
            <span className="txt-outline">Log out</span>
          </button>
        ) : (
          <button type="button" className="btn3d buy-btn bg-purple" disabled={status !== 'ready'} onClick={login}>
            <span className="txt-outline">{status === 'ready' ? 'Log in' : '…'}</span>
          </button>
        )}
      </div>

      <div className="body-text mt-2 text-[15px] opacity-80">
        Controls: WASD / arrows to move · Shift sprint · Space jump · Click or F to throw · E to interact · Right-drag to turn the
        camera · Scroll to zoom. On phones: left stick to move, tap anywhere to throw, drag to look.
        <br />
        Room: {roomId}
      </div>
    </Window>
  )
}
