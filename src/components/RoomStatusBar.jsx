import { AVATARS } from '../lib/profile'

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
            {player.avatarId
              ? <span className="text-[11px] leading-none flex-shrink-0">{AVATARS.find(a => a.id === player.avatarId)?.emoji || ''}</span>
              : <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${player.done ? 'bg-green-400' : player.ready ? 'bg-blue-400' : 'bg-ink/20'}`} />
            }
            <span className="text-ink/50 text-[11px] truncate">{player.name || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
