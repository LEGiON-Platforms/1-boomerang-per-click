import { BOOMERANGS, C2S } from '@game/shared'

import { playSfx } from '../audio/sfx'
import { send } from '../net/connection'
import { game } from '../state/gameStore'
import { ui } from '../state/uiStore'
import { pedestalStart } from './lobby/LobbySigns'

/** "E" / tap on the prompt: act on whatever lobby object the player is next to. */
export function interact(): void {
  const g = game()
  const target = g.nearInteract
  if (!target || !g.data) return
  playSfx('click')
  switch (target.kind) {
    case 'trails':
      ui().openPanel('trails')
      break
    case 'rebirth':
      ui().openPanel('rebirth')
      break
    case 'stages':
      ui().openPanel('stages')
      break
    case 'egg':
      ui().openPanel('egg', target.index)
      break
    case 'pedestal': {
      const id = pedestalStart(g.data.boomerangsOwned) + target.index
      if (id === g.data.boomerangsOwned && BOOMERANGS[id]) send(C2S.buyBoomerang)
      else ui().openPanel('shop')
      break
    }
  }
}
