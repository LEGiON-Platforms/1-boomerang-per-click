import {
  C2S,
  maxPetSlots,
  PET_BY_ID,
  petBonus,
  petBonusSum,
  type PetInstance,
  PETS_CONFIG,
  RARITY,
  rarityIndex,
} from '@game/shared'
import { useMemo, useState } from 'react'

import { playSfx } from '../../audio/sfx'
import { send } from '../../net/connection'
import { useGame } from '../../state/gameStore'
import { ui } from '../../state/uiStore'
import { StarIcon } from '../icons'
import { PetPortrait } from '../PetPortrait'

const bonusOf = (p: PetInstance) => petBonus(p.rarity, p.golden)

/** Shop tab — pet inventory: equip, equip best, merge 5 → golden, delete. */
export function ItemsTab() {
  const data = useGame((s) => s.data)
  const [selected, setSelected] = useState<string | null>(null)

  const sorted = useMemo(() => {
    if (!data) return []
    const equipped = new Set(data.equippedPets)
    return data.pets
      .slice()
      .sort((a, b) => Number(equipped.has(b.uid)) - Number(equipped.has(a.uid)) || bonusOf(b) - bonusOf(a))
  }, [data])

  // Groups of 5+ identical non-golden pets that can merge.
  const mergeable = useMemo(() => {
    if (!data) return []
    const groups = new Map<string, { petId: string; rarity: PetInstance['rarity']; count: number }>()
    for (const p of data.pets) {
      if (p.golden) continue
      const key = `${p.petId}:${p.rarity}`
      const g = groups.get(key) ?? { petId: p.petId, rarity: p.rarity, count: 0 }
      g.count += 1
      groups.set(key, g)
    }
    return [...groups.values()].filter((g) => g.count >= PETS_CONFIG.goldenMergeCount)
  }, [data])

  if (!data) return null
  const slots = maxPetSlots(data)
  const equipped = new Set(data.equippedPets)
  const pet = data.pets.find((p) => p.uid === selected) ?? null

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="txt-outline text-[24px]">
          Pets {data.pets.length}/{PETS_CONFIG.inventoryMax} · Equipped {data.equippedPets.length}/{slots} ·{' '}
          <span style={{ color: '#5fd3ff' }}>+{Math.round(petBonusSum(data) * 100)}% Power</span>
        </div>
        <div className="flex gap-2">
          {mergeable.slice(0, 1).map((g) => (
            <button
              key={`${g.petId}:${g.rarity}`}
              type="button"
              className="btn3d buy-btn bg-yellow"
              onClick={() => {
                playSfx('click')
                send(C2S.mergePets, { petId: g.petId, rarity: g.rarity })
              }}
            >
              <StarIcon size={28} />
              <span className="txt-outline text-[22px]">Merge 5 {PET_BY_ID[g.petId]?.name}</span>
            </button>
          ))}
          <button
            type="button"
            className="btn3d buy-btn bg-green"
            disabled={data.pets.length === 0}
            onClick={() => {
              playSfx('click')
              send(C2S.equipBestPets)
            }}
          >
            <span className="txt-outline">Equip Best</span>
          </button>
        </div>
      </div>

      {data.pets.length === 0 ? (
        <div className="body-text py-10 text-center text-[18px]">
          No pets yet! Open the "?" blocks by the leaderboards, find Lucky Blocks, or claim gifts.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {sorted.map((p) => {
            const r = RARITY[p.rarity]
            const isEq = equipped.has(p.uid)
            return (
              <button
                key={p.uid}
                type="button"
                onClick={() => setSelected(p.uid === selected ? null : p.uid)}
                className="relative flex flex-col items-center rounded-xl border-4 p-1"
                style={{
                  borderColor: r.color,
                  background: p.uid === selected ? '#33384a' : '#1a1c24',
                  boxShadow: rarityIndex(p.rarity) >= 4 ? `0 0 14px ${r.color}` : undefined,
                }}
              >
                <PetPortrait petId={p.petId} golden={p.golden} size={70} />
                <span className="txt-outline text-[15px]" style={{ color: r.color }}>
                  {p.golden ? 'Golden ' : ''}
                  {r.name}
                </span>
                <span className="txt-outline text-[14px]">+{Math.round(bonusOf(p) * 100)}%</span>
                {isEq && <span className="txt-outline absolute right-1 top-0 text-[22px]" style={{ color: '#7dff6b' }}>✓</span>}
              </button>
            )
          })}
        </div>
      )}

      {pet && (
        <div className="list-row mt-4 flex-wrap">
          <PetPortrait petId={pet.petId} golden={pet.golden} size={64} />
          <div className="flex-1">
            <div className="txt-outline text-[28px]">
              {pet.golden ? 'Golden ' : ''}
              {PET_BY_ID[pet.petId]?.name}
            </div>
            <div className="txt-outline text-[20px]" style={{ color: RARITY[pet.rarity].color }}>
              {RARITY[pet.rarity].name} · +{Math.round(bonusOf(pet) * 100)}% Power
            </div>
          </div>
          {equipped.has(pet.uid) ? (
            <button type="button" className="btn3d buy-btn bg-dark" onClick={() => send(C2S.unequipPet, { uid: pet.uid })}>
              <span className="txt-outline">Unequip</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn3d buy-btn bg-green"
              disabled={data.equippedPets.length >= slots}
              onClick={() => send(C2S.equipPet, { uid: pet.uid })}
            >
              <span className="txt-outline">Equip</span>
            </button>
          )}
          <button
            type="button"
            className="btn3d buy-btn bg-red"
            onClick={() =>
              ui().ask('Delete pet?', `${PET_BY_ID[pet.petId]?.name} (${RARITY[pet.rarity].name}) will be gone for good.`, 'Delete', () => {
                send(C2S.deletePet, { uid: pet.uid })
                setSelected(null)
              })
            }
          >
            <span className="txt-outline">Delete</span>
          </button>
        </div>
      )}
      <div className="body-text mt-3 text-[14px] opacity-75">
        Merge 5 identical pets into a Golden one (x{PETS_CONFIG.goldenMult} bonus). Extra pet slots unlock at Rebirth{' '}
        {PETS_CONFIG.extraSlotRebirths.join(', ')}.
      </div>
    </>
  )
}
