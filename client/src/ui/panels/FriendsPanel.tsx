import { C2S, FRIEND_BOOST, friendBoostFraction, MAX_CLIENTS } from '@game/shared'

import { playSfx } from '../../audio/sfx'
import { send } from '../../net/connection'
import { useGame } from '../../state/gameStore'
import { ui } from '../../state/uiStore'
import { FriendsIcon } from '../icons'
import { Window } from '../Window'

/** Room player list: add friends here for the Friend Boost, and invite people in. */
export function FriendsPanel() {
  const players = useGame((s) => s.roomPlayers)
  const friends = useGame((s) => s.data?.friends ?? [])
  const roomId = useGame((s) => s.roomId)
  const inRoom = players.filter((p) => !p.isLocal && friends.includes(p.pid)).length
  const link = `${location.origin}${location.pathname}?room=${encodeURIComponent(roomId)}`

  const copy = async () => {
    playSfx('click')
    try {
      await navigator.clipboard.writeText(link)
      ui().toast('Invite link copied!', 'success')
    } catch {
      ui().toast('Copy failed — share this link: ' + link, 'info')
    }
  }

  return (
    <Window title="Players" onClose={() => ui().closePanel()} width={720}>
      <div className="list-row flex-wrap">
        <FriendsIcon size={56} />
        <div className="flex-1">
          <div className="txt-outline text-[26px]">
            Friend Boost: <span style={{ color: '#ffd21f' }}>+{Math.round(friendBoostFraction(inRoom) * 100)}%</span>
          </div>
          <div className="body-text text-[15px]">
            +{FRIEND_BOOST.perFriend * 100}% Power for each friend in your server (max +{FRIEND_BOOST.max * 100}%).
          </div>
        </div>
        <button type="button" className="btn3d buy-btn bg-purple" onClick={copy}>
          <span className="txt-outline">Copy invite</span>
        </button>
      </div>
      <div className="txt-outline mb-2 mt-4 text-[24px]">
        In this server ({players.length}/{MAX_CLIENTS})
      </div>
      {players.map((p) => {
        const isFriend = friends.includes(p.pid)
        return (
          <div key={p.sessionId} className="list-row">
            <div className="flex-1">
              <span className="txt-outline text-[26px]">{p.name}</span>
              <span className="txt-outline ml-2 text-[18px]" style={{ color: '#ffd21f' }}>
                Lv {p.level}
              </span>
              {p.isLocal && <span className="body-text ml-2 text-[15px] opacity-70">(you)</span>}
            </div>
            {!p.isLocal && (
              <button
                type="button"
                className={`btn3d buy-btn ${isFriend ? 'bg-dark' : 'bg-green'}`}
                onClick={() => {
                  playSfx('click')
                  send(isFriend ? C2S.removeFriend : C2S.addFriend, { pid: p.pid })
                }}
              >
                <span className="txt-outline">{isFriend ? 'Remove' : 'Add Friend'}</span>
              </button>
            )}
          </div>
        )
      })}
    </Window>
  )
}
