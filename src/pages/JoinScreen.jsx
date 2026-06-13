import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { joinSession, getOrCreatePlayerId, getOrCreatePlayerName } from '../lib/session'
import { getProfile } from '../lib/profile'

export default function JoinScreen() {
  const { code: urlCode } = useParams()
  const [code, setCode] = useState(urlCode || '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Auto-join state when arriving via an invite link (/join/:code)
  const [autoJoining, setAutoJoining] = useState(!!urlCode)
  const autoJoinAttemptedRef = useRef(false)
  const navigate = useNavigate()

  async function doJoin(rawCode) {
    const trimmed = rawCode.trim().toUpperCase()
    if (trimmed.length < 4) { setError('Enter a valid code'); return }
    setLoading(true)
    setError('')
    try {
      const playerId = getOrCreatePlayerId()
      const playerName = getOrCreatePlayerName()
      const p = getProfile()
      await joinSession(trimmed, playerId, playerName, p?.avatarId ?? null, p?.colorId ?? null)
      navigate(`/session/${trimmed}/lobby`, { replace: true })
    } catch (e) {
      setError(e.message || 'Session not found')
      setLoading(false)
      setAutoJoining(false)
    }
  }

  // Invite link: join automatically and land in the lobby.
  useEffect(() => {
    if (!urlCode || autoJoinAttemptedRef.current) return
    autoJoinAttemptedRef.current = true
    doJoin(urlCode)
  }, [urlCode])

  function handleJoin() {
    doJoin(code)
  }

  if (autoJoining) {
    return (
      <motion.div
        className="min-h-screen bg-cream flex flex-col items-center justify-center px-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
          className="text-6xl mb-5"
        >
          🎨
        </motion.div>
        <h1 className="font-display text-3xl text-ink mb-2" style={{ fontFamily: "'Fredoka One', cursive" }}>
          Joining room…
        </h1>
        <p className="text-ink/50 font-body text-sm">
          Taking you to <span className="font-mono font-bold tracking-widest">{urlCode}</span>
        </p>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="min-h-screen bg-cream flex flex-col items-center justify-center px-6"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
    >
      <button onClick={() => navigate('/')} className="absolute top-6 left-6 text-ink/50 font-body text-sm flex items-center gap-1 active:scale-95 transition-transform">
        ← Back
      </button>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-5xl mb-3">🔑</div>
          <h1 className="font-display text-4xl text-ink mb-2" style={{ fontFamily: "'Fredoka One', cursive" }}>Join a Room</h1>
          <p className="text-ink/50 font-body text-sm">Ask the host for the code</p>
        </div>
        <div className="bg-white rounded-3xl shadow-paper p-6 border border-ink/5">
          <label className="block text-ink/50 text-xs font-semibold font-body mb-2 uppercase tracking-wider">Room Code</label>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="ABC123"
            maxLength={8}
            className="w-full text-center text-4xl font-display tracking-widest bg-cream rounded-2xl px-4 py-4 border-2 border-ink/10 focus:border-blue-400 outline-none transition-colors"
            style={{ fontFamily: "'Fredoka One', cursive" }}
          />
          {error && <p className="text-red-500 text-sm font-body text-center mt-3">{error}</p>}
          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full mt-4 bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lifted active:scale-95 transition-all font-body text-lg disabled:opacity-60"
          >
            {loading ? 'Joining…' : 'Join Room 🎨'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
