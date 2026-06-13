import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { updateSessionSettings, updateSessionStatus, subscribeToSession, getOrCreatePlayerId } from '../lib/session'

// Old rooms may arrive here with status='settings'. This screen now shows
// only the explanatory copy and advances directly to tearing — no mode choices.
const MVP_SETTINGS = { mode: 'tear', visibility: 'reveal', lineHelper: 'correction' }

export default function SessionSettings() {
  const { code } = useParams()
  const navigate = useNavigate()
  const playerId = getOrCreatePlayerId()
  const [session, setSession] = useState(null)

  useEffect(() => {
    const unsub = subscribeToSession(code, (data) => {
      if (!data) return
      setSession(data)
      if (data.status === 'ready_check') navigate(`/session/${code}/ready`)
      if (data.status === 'tearing') navigate(`/session/${code}/tear`)
    })
    return unsub
  }, [code])

  const isHost = (session?.roundControllerId || session?.hostId) === playerId

  async function handleStart() {
    try {
      await updateSessionSettings(code, MVP_SETTINGS)
      await updateSessionStatus(code, 'tearing')
      navigate(`/session/${code}/tear`)
    } catch {
      navigate(`/session/${code}/tear`)
    }
  }

  return (
    <motion.div
      className="min-h-screen bg-cream flex flex-col"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex items-center gap-4 px-6 pt-8 pb-4">
        {isHost && (
          <button
            onClick={async () => {
              await updateSessionStatus(code, 'picking')
              navigate(`/session/${code}/pick`)
            }}
            className="text-ink/50 font-body active:scale-95 transition-transform text-lg"
          >←</button>
        )}
        <h1 className="font-display text-2xl text-ink" style={{ fontFamily: "'Fredoka One', cursive" }}>
          Ready to color?
        </h1>
      </div>

      {!isHost && (
        <div className="mx-6 mb-4 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-blue-700 font-body text-sm">
          The host is getting the round ready. Hold on…
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 pb-32 no-scrollbar">
        <div className="bg-white rounded-3xl shadow-paper p-5 border border-ink/5">
          <div className="flex items-start gap-3">
            <span className="text-3xl flex-shrink-0">🎁</span>
            <div>
              <div className="font-display text-lg text-ink" style={{ fontFamily: "'Fredoka One', cursive" }}>
                Hidden reveal
              </div>
              <p className="text-ink/50 font-body text-[13px] leading-relaxed mt-0.5">
                You'll each color a hidden part of the same page. When everyone is done, the full artwork is revealed. 🎉
              </p>
            </div>
          </div>
        </div>
      </div>

      {isHost && (
        <div className="fixed bottom-0 left-0 right-0 bg-cream/95 backdrop-blur-sm px-6 pb-8 pt-4 border-t border-ink/5">
          <button
            onClick={handleStart}
            className="w-full bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lifted active:scale-95 transition-all font-body text-lg"
          >
            Continue to Tear ✂️
          </button>
        </div>
      )}
    </motion.div>
  )
}
