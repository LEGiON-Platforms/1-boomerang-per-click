import { EGG_BY_ID, PET_BY_ID, petBonus, RARITY, VIP_BOOMERANG } from '@game/shared'
import { useEffect, useState } from 'react'

import { playSfx } from '../../audio/sfx'
import { useUI } from '../../state/uiStore'
import { BoomerangIcon } from '../icons'
import { PetPortrait } from '../PetPortrait'

type Phase = 'shake' | 'burst' | 'reveal'

/** Egg opening: the block shakes, bursts, then the hatched pets are dealt out. */
export function EggReveal() {
  const current = useUI((s) => s.eggQueue[0])
  const shiftEgg = useUI((s) => s.shiftEgg)
  const [phase, setPhase] = useState<Phase>('shake')

  useEffect(() => {
    if (!current) return
    setPhase('shake')
    playSfx('egg')
    const t1 = window.setTimeout(() => setPhase('burst'), 850)
    const t2 = window.setTimeout(() => {
      setPhase('reveal')
      playSfx('reveal')
    }, 1100)
    // Reveals clear themselves so auto-open can keep going.
    const t3 = window.setTimeout(() => shiftEgg(), 3400)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [current, shiftEgg])

  if (!current) return null
  const egg = EGG_BY_ID[current.egg]

  return (
    <div
      className="overlay-center overlay-dim"
      style={{ zIndex: 55 }}
      onPointerDown={() => phase === 'reveal' && shiftEgg()}
    >
      {phase !== 'reveal' ? (
        <div
          className="txt-outline grid place-items-center rounded-2xl border-8 border-[#1b1b22] text-[96px]"
          style={{
            width: 220,
            height: 220,
            background: egg.color,
            animation: phase === 'shake' ? 'egg-shake 0.12s linear infinite' : 'egg-burst 0.25s ease-out forwards',
            boxShadow: '0 0 60px rgba(255,255,255,0.4)',
          }}
        >
          ??
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          {current.free && <div className="txt-outline text-[36px]" style={{ color: '#7dff6b' }}>Free {egg.name}!</div>}
          <div className="flex flex-wrap justify-center gap-5">
            {current.vip && (
              <div className="reveal-card" style={{ borderColor: VIP_BOOMERANG.color }}>
                <BoomerangIcon size={110} color={VIP_BOOMERANG.color} />
                <span className="txt-outline text-[26px]" style={{ color: VIP_BOOMERANG.color }}>
                  VIP BOOMERANG!
                </span>
                <span className="body-text text-[15px]">{VIP_BOOMERANG.multiplier}x your best boomerang</span>
              </div>
            )}
            {current.pets.map((p) => {
              const def = PET_BY_ID[p.petId]
              const r = RARITY[p.rarity]
              return (
                <div key={p.uid} className="reveal-card" style={{ borderColor: r.color, boxShadow: `0 0 40px ${r.color}` }}>
                  <PetPortrait petId={p.petId} golden={p.golden} size={120} />
                  <span className="txt-outline text-[28px]">{def?.name}</span>
                  <span className="txt-outline text-[26px]" style={{ color: r.color }}>
                    {r.name}
                  </span>
                  <span className="txt-outline text-[20px]" style={{ color: '#5fd3ff' }}>
                    +{Math.round(petBonus(p.rarity, p.golden) * 100)}% Power
                  </span>
                </div>
              )
            })}
          </div>
          <div className="body-text text-[16px] opacity-80">Tap to continue</div>
        </div>
      )}
    </div>
  )
}
