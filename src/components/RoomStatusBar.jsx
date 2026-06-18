import { AVATAR_COLORS } from '../lib/profile'
import PencilTip from './PencilTip'

function MiniPencilAvatar({ colorId }) {
  const col = AVATAR_COLORS.find(c => c.id === colorId) || AVATAR_COLORS[0]
  return (
    <div
      className="rounded-[5px] flex items-center justify-center flex-shrink-0 overflow-hidden"
      style={{ width: 16, height: 16, background: col.hex }}
    >
      <PencilTip size={11} />
    </div>
  )
}

export default function RoomStatusBar({ session, code }) {
  if (!session || !code) return null
  const players = Object.entries(session.players || {}).filter(([, p]) => p.name && !p.left)
  if (players.length === 0) return null

  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 border-b border-ink/8 font-body"
      style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(6px)' }}
    >
      <span
        className="font-bold tracking-[0.12em] text-[#7C5CFF]/80 flex-shrink-0 text-[11px]"
        style={{ fontFamily: "'Fredoka One', cursive" }}
      >
        {code}
      </span>
      <span className="text-ink/20 flex-shrink-0 text-xs">·</span>
      <div className="flex items-center gap-2.5 flex-1 min-w-0 overflow-hidden">
        {players.map(([pid, player]) => (
          <div key={pid} className="flex items-center gap-1 min-w-0">
            <MiniPencilAvatar colorId={player.colorId} />
            <span className="text-ink/50 text-[11px] truncate">{player.name || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
