import { C2S, formatDuration, LUCKY_PHASE, TRAILS, TUTORIAL, TUTORIAL_STEPS } from '@game/shared'
import { useEffect, useRef } from 'react'

import { send } from '../../net/connection'
import { useGame } from '../../state/gameStore'

function Objective({ title, emoji, value, max }: { title: string; emoji?: string; value?: number; max?: number }) {
  return (
    <div className="objective">
      {/* The emoji sits outside the gradient-clipped text, which would repaint it. */}
      <div className="flex items-center gap-3">
        <span className="title">{title}</span>
        {emoji && <span className="text-[52px] leading-none">{emoji}</span>}
      </div>
      {max !== undefined && value !== undefined && (
        <div className="progress">
          <div className="fill" style={{ width: `${Math.min(1, value / max) * 100}%` }} />
          <div className="text txt-outline">
            {Math.floor(Math.min(value, max * 10))} / {max}
          </div>
        </div>
      )}
    </div>
  )
}

/** Top-centre: tutorial objectives, then the lucky-block countdown. */
export function HudTop() {
  const step = useGame((s) => s.data?.tutorialStep ?? TUTORIAL_STEPS.done)
  const power = useGame((s) => s.power)
  const wins = useGame((s) => s.wins)
  const run = useGame((s) => s.run)
  const lucky = useGame((s) => s.lucky)
  const requested = useRef(false)

  // The reward roll is requested once the trail is bought; the server picks it.
  useEffect(() => {
    if (step === TUTORIAL_STEPS.reward && !requested.current) {
      requested.current = true
      send(C2S.rollTutorialReward)
    }
  }, [step])

  let body: React.ReactNode
  switch (step) {
    case TUTORIAL_STEPS.train:
      body = <Objective title="Train here!" emoji="💪" value={power} max={TUTORIAL.trainPower} />
      break
    case TUTORIAL_STEPS.breakWalls:
      body = <Objective title="Break the walls!" emoji="🧱" value={run.stage === 1 ? run.wallsBroken : 0} max={10} />
      break
    case TUTORIAL_STEPS.collectWins:
      body = <Objective title="Collect your Wins!" emoji="🏆" />
      break
    case TUTORIAL_STEPS.buyTrail:
      body = <Objective title="Click to buy!" emoji="👆" value={wins} max={TRAILS[TUTORIAL.trailId].cost} />
      break
    default:
      body =
        lucky.phase === LUCKY_PHASE.active ? (
          <div className="lucky-line txt-outline">
            Find The Lucky Block! {formatDuration(lucky.secondsLeft)}
            <span className="sub txt-outline">
              A <span style={{ color: '#5fd3ff' }}>Lucky Block</span> Has Fallen!{' '}
              <span style={{ color: '#ffe14a' }}>First To Find It</span> Gets It!
            </span>
          </div>
        ) : (
          <div className="lucky-line txt-outline">Lucky Block Drop In {formatDuration(lucky.secondsLeft)}</div>
        )
  }

  return <div className="hud-group hud-tc">{body}</div>
}
