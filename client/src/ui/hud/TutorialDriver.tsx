import { C2S, TUTORIAL_STEPS } from '@game/shared'
import { useEffect, useRef } from 'react'

import { send } from '../../net/connection'
import { useGame } from '../../state/gameStore'

/**
 * The tutorial runs without an on-screen objective banner (the top of the screen
 * stays clear). This only asks the server for the tutorial reward roll once the
 * player reaches that step; the server picks it.
 */
export function TutorialDriver() {
  const step = useGame((s) => s.data?.tutorialStep ?? TUTORIAL_STEPS.done)
  const requested = useRef(false)
  useEffect(() => {
    if (step === TUTORIAL_STEPS.reward && !requested.current) {
      requested.current = true
      send(C2S.rollTutorialReward)
    }
  }, [step])
  return null
}
