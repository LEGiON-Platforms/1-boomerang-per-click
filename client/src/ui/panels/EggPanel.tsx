import {
  C2S,
  EGGS,
  formatNumber,
  isEggUnlocked,
  PETS_CONFIG,
  petsOfEgg,
  RARITIES,
  RARITY,
} from '@game/shared'
import { useEffect, useState } from 'react'

import { playSfx } from '../../audio/sfx'
import { send } from '../../net/connection'
import { useGame } from '../../state/gameStore'
import { ui, useUI } from '../../state/uiStore'
import { LockIcon, PumpkinIcon, TrophyIcon } from '../icons'
import { PetPortrait } from '../PetPortrait'
import { Window } from '../Window'

const AUTO_INTERVAL_MS = 2600

export function EggPanel() {
  const index = useUI((s) => s.panelArg)
  const egg = EGGS[index]
  const data = useGame((s) => s.data)
  const wins = useGame((s) => s.wins)
  const near = useGame((s) => s.nearInteract?.kind === 'egg' && s.nearInteract.index === index)
  const revealing = useUI((s) => s.eggQueue.length > 0)
  const [auto, setAuto] = useState(false)

  const balance = egg?.currency === 'pumpkins' ? (data?.pumpkins ?? 0) : wins
  const triple = (data?.rebirths ?? 0) >= PETS_CONFIG.tripleOpenRebirths
  const unlocked = data && egg ? isEggUnlocked(data, egg) : false
  const full = (data?.pets.length ?? 0) >= PETS_CONFIG.inventoryMax

  // Walking away closes the egg (the server would refuse anyway).
  useEffect(() => {
    if (!near) ui().closePanel()
  }, [near])

  // Auto-open keeps hatching while affordable, pausing for each reveal.
  useEffect(() => {
    if (!auto || !egg) return
    const id = window.setInterval(() => {
      const g = useGame.getState()
      const bal = egg.currency === 'pumpkins' ? (g.data?.pumpkins ?? 0) : g.wins
      if (useUI.getState().eggQueue.length > 0) return
      if (bal < egg.cost || (g.data?.pets.length ?? 0) >= PETS_CONFIG.inventoryMax) {
        setAuto(false)
        return
      }
      const count = triple && bal >= egg.cost * 3 ? 3 : 1
      send(C2S.openEgg, { egg: egg.id, count })
    }, AUTO_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [auto, egg, triple])

  if (!egg || !data) return null
  const Currency = egg.currency === 'pumpkins' ? PumpkinIcon : TrophyIcon
  const pity = data.eggPity[egg.id] ?? 0
  const open = (count: 1 | 3) => {
    playSfx('click')
    send(C2S.openEgg, { egg: egg.id, count })
  }

  return (
    <Window title={egg.name} onClose={() => ui().closePanel()} width={820}>
      <div className="flex flex-wrap justify-center gap-4">
        {petsOfEgg(egg.id).map((p) => (
          <div key={p.id} className="flex w-[140px] flex-col items-center rounded-xl border-4 border-[#1b1b22] bg-[#1a1c24] p-2">
            <PetPortrait petId={p.id} size={84} />
            <span className="txt-outline text-center text-[18px]">{p.name}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {RARITIES.map((r, i) =>
          egg.odds[i] > 0 ? (
            <span key={r} className="chip txt-outline" style={{ color: RARITY[r].color, fontSize: 20 }}>
              {RARITY[r].name} {egg.odds[i]}% · +{Math.round(RARITY[r].bonus * 100)}%
            </span>
          ) : null,
        )}
        {egg.vipChance && !data.vipBoomerang && (
          <span className="chip txt-outline" style={{ color: '#ffb300', fontSize: 20 }}>
            VIP Boomerang {egg.vipChance}%
          </span>
        )}
      </div>
      <div className="body-text mt-3 text-center text-[16px]">
        Guaranteed Epic or better within {PETS_CONFIG.pityOpens - pity} opens · Pets {data.pets.length}/{PETS_CONFIG.inventoryMax}
      </div>

      {!unlocked ? (
        <div className="txt-outline mt-5 flex items-center justify-center gap-3 text-[32px]" style={{ color: '#ff6b6b' }}>
          <LockIcon size={40} /> Clear Stage {egg.unlockStage} to unlock
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-4">
          <button type="button" className="btn3d buy-btn bg-green" disabled={revealing || balance < egg.cost || full} onClick={() => open(1)}>
            <span className="txt-outline">Open 1</span>
            <Currency size={30} />
            <span className="txt-outline">{formatNumber(egg.cost)}</span>
          </button>
          <button
            type="button"
            className="btn3d buy-btn bg-blue"
            disabled={!triple || revealing || balance < egg.cost * 3 || full}
            onClick={() => open(3)}
          >
            {!triple && <LockIcon size={26} />}
            <span className="txt-outline">Open 3</span>
            <Currency size={30} />
            <span className="txt-outline">{formatNumber(egg.cost * 3)}</span>
          </button>
          <button type="button" className={`btn3d buy-btn ${auto ? 'bg-yellow' : 'bg-dark'}`} onClick={() => setAuto((a) => !a)}>
            <span className="txt-outline">Auto: {auto ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      )}
      {!triple && unlocked && <div className="body-text mt-2 text-center text-[15px] opacity-80">Open 3 unlocks at Rebirth {PETS_CONFIG.tripleOpenRebirths}.</div>}
      {full && <div className="body-text mt-2 text-center text-[15px] text-red-300">Inventory full — merge or delete pets in Items.</div>}
    </Window>
  )
}
