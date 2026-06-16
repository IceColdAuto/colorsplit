import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { subscribeToSession, setPlayerReady, updateSessionStatus, getOrCreatePlayerId, leaveRoom, setupPresence } from '../lib/session'
import { AVATARS, AVATAR_COLORS } from '../lib/profile'
import RoomStatusBar from '../components/RoomStatusBar'
import LeaveRoomModal from '../components/LeaveRoomModal'

export default function ReadyCheck() {
  const { code } = useParams()
  const navigate = useNavigate()
  const playerId = getOrCreatePlayerId()
  const [session, setSession] = useState(null)
  const [countdown, setCountdown] = useState(null)
  const [myReady, setMyReady] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [abandonedByName, setAbandonedByName] = useState(null)
  const countdownStarted = useRef(false)
  const isLeavingRef = useRef(false)

  useEffect(() => setupPresence(code, playerId), [code, playerId])

  useEffect(() => {
    const unsub = subscribeToSession(code, (data) => {
      if (isLeavingRef.current || !data) return
      // Block only when NO other active player remains.
      const others = Object.entries(data.players || {}).filter(([pid]) => pid !== playerId)
      const othersActive = others.filter(([, p]) => p.name && !p.left)
      const othersLeft = others.filter(([, p]) => p.left)
      if (othersLeft.length > 0 && othersActive.length === 0 && data.settings?.mode !== 'solo') {
        setAbandonedByName(othersLeft[0][1].name || 'The other player'); return
      }
      setSession(data)
      if (data.status === 'coloring') navigate(`/session/${code}/color`)

      // A player who left must not hold the countdown hostage.
      const activePlayers = Object.values(data.players || {}).filter(p => p.name && !p.left)
      if (activePlayers.length >= 1 && activePlayers.every(p => p.ready) && !countdownStarted.current) {
        countdownStarted.current = true
        startCountdown()
      }
    })
    return unsub
  }, [code])

  function startCountdown() {
    let n = 3
    setCountdown(n)
    const iv = setInterval(() => {
      n -= 1
      if (n <= 0) {
        clearInterval(iv)
        setCountdown(0)
        updateSessionStatus(code, 'coloring').catch(() => {})
        setTimeout(() => navigate(`/session/${code}/color`), 300)
      } else {
        setCountdown(n)
      }
    }, 1000)
  }

  async function handleLeaveConfirm() {
    isLeavingRef.current = true
    setShowLeaveModal(false)
    try { await leaveRoom(code, playerId) } catch {}
    navigate('/', { replace: true })
  }

  async function handleReady() {
    setMyReady(true)
    try {
      await setPlayerReady(code, playerId, true)
    } catch {
      if (!countdownStarted.current) {
        countdownStarted.current = true
        startCountdown()
      }
    }
  }

  const players = session
    ? Object.entries(session.players || {}).filter(([, p]) => p.name && !p.left)
    : []
  const allReady = players.length >= 1 && players.every(([, p]) => p.ready)

  return (
    <motion.div
      className="min-h-screen bg-cream flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header row */}
      <div className="flex items-center px-6 pt-6 pb-0">
        <button
          onClick={() => setShowLeaveModal(true)}
          className="text-ink/50 font-body active:scale-95 transition-transform text-lg"
        >←</button>
      </div>
      <div className="flex justify-center px-6 pt-2 pb-1">
        <div className="rounded-2xl overflow-hidden w-full max-w-xs shadow-sm">
          <RoomStatusBar session={session} code={code} />
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6">
      <AnimatePresence mode="wait">
        {countdown !== null ? (
          <motion.div
            key="countdown"
            className="flex flex-col items-center gap-4"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={countdown}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.4, opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="font-display text-9xl"
                style={{ color: '#7C5CFF', fontFamily: "'Fredoka One', cursive" }}
              >
                {countdown === 0 ? '🎨' : countdown}
              </motion.div>
            </AnimatePresence>
            <p className="text-ink/50 font-body text-lg">Get ready!</p>
          </motion.div>
        ) : (
          <motion.div key="ready" className="w-full max-w-sm">
            <div className="text-center mb-8">
              <div className="text-5xl mb-3">✨</div>
              <h1 className="font-display text-4xl text-ink mb-2" style={{ fontFamily: "'Fredoka One', cursive" }}>
                Ready to color together?
              </h1>
              <p className="text-ink/50 font-body text-sm">We'll start when everyone is ready.</p>
            </div>

            <div className="bg-white rounded-3xl shadow-paper p-5 border border-ink/5 mb-5">
              <p className="text-ink/40 text-xs font-semibold uppercase tracking-wider font-body mb-3">Players</p>
              <div className="space-y-2">
                {players.map(([pid, player]) => (
                  <div key={pid} className="flex items-center gap-3 py-2 px-3 bg-cream rounded-xl">
                    {/* Avatar circle */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 font-bold"
                      style={{
                        background: AVATAR_COLORS.find(c => c.id === player.colorId)?.hex || '#dbeafe',
                        color: '#1e3a5f',
                      }}
                    >
                      {AVATARS.find(a => a.id === player.avatarId)?.emoji || player.name?.[0] || '?'}
                    </div>
                    {/* Ready indicator */}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                      player.ready ? 'bg-green-100 text-green-600' : 'bg-purple-50 text-purple-300'
                    }`}>
                      {player.ready ? '✓' : '…'}
                    </div>
                    <span className="font-semibold font-body text-ink text-sm flex-1 truncate">{player.name || '—'}</span>
                    <span className={`text-xs font-semibold font-body flex-shrink-0 ${player.ready ? 'text-green-500' : 'text-ink/30'}`}>
                      {player.ready ? 'Ready!' : 'Not ready yet'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {!myReady && (
              <motion.button
                onClick={handleReady}
                whileTap={{ scale: 0.95 }}
                className="w-full text-white font-bold py-5 rounded-2xl shadow-deep font-body text-xl"
                style={{ background: 'linear-gradient(135deg, #8B6EF8 0%, #7C5CFF 100%)' }}
              >
                I'm ready
              </motion.button>
            )}

            {myReady && !allReady && (
              <div className="text-center py-4">
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ repeat: Infinity, duration: 1.4 }}
                  className="text-4xl mb-2"
                >
                  ⌛
                </motion.div>
                <p className="text-ink/40 font-body text-sm">Waiting for the others…</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      <LeaveRoomModal
        showConfirm={showLeaveModal}
        onCancel={() => setShowLeaveModal(false)}
        onConfirm={handleLeaveConfirm}
        abandonedByName={abandonedByName}
        onGoHome={() => { isLeavingRef.current = true; navigate('/', { replace: true }) }}
      />
    </motion.div>
  )
}
