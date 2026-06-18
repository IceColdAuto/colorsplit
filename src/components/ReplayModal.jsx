import { useEffect, useMemo, useState } from 'react'
import { getAllStrokes } from '../lib/session'
import TimeLapsePlayer from './TimeLapsePlayer'
import MaskedTearReplay from './MaskedTearReplay'

/**
 * ReplayModal
 *
 * Full-screen overlay that fetches session strokes from Firebase and plays
 * them back using TimeLapsePlayer (solo) or MaskedTearReplay (together).
 *
 * This component never saves, navigates, or touches the final image state.
 * If strokes are missing or the fetch fails it shows a graceful fallback.
 *
 * Props:
 *   code        — session code
 *   sessionData — existing RevealScreen sessionData state (needs mode, tearLine,
 *                 players, zones); never mutated here
 *   playerId    — current player's id (used for solo flatten)
 *   colorPage   — resolved colorPage object or null
 *   onClose     — fn() called when the modal should close
 */
export default function ReplayModal({ code, sessionData, playerId, colorPage, onClose }) {
  // 'loading' | 'ready' | 'empty' | 'error'
  const [fetchPhase, setFetchPhase] = useState('loading')
  const [allStrokes, setAllStrokes] = useState(null)

  const isSolo = sessionData?.settings?.mode === 'solo'

  useEffect(() => {
    let cancelled = false
    getAllStrokes(code)
      .then(data => {
        if (cancelled) return
        setAllStrokes(data || {})
        setFetchPhase('ready')
      })
      .catch(() => {
        if (!cancelled) setFetchPhase('error')
      })
    return () => { cancelled = true }
  }, [code])

  // Stable array — Object.values().filter() would create a new ref every render,
  // causing TimeLapsePlayer's [strokes] effect to restart the animation.
  const soloStrokes = useMemo(() => {
    if (fetchPhase !== 'ready' || !isSolo) return []
    return Object.values(allStrokes?.[playerId] || {}).filter(s => s?.points?.length)
  }, [fetchPhase, isSolo, allStrokes, playerId])

  // Check whether multiplayer has any strokes at all
  const multiplayerHasStrokes = useMemo(() => {
    if (fetchPhase !== 'ready' || isSolo) return false
    return Object.values(allStrokes || {}).some(
      playerStrokes => Object.values(playerStrokes || {}).some(s => s?.points?.length)
    )
  }, [fetchPhase, isSolo, allStrokes])

  const hasStrokes = isSolo ? soloStrokes.length > 0 : multiplayerHasStrokes

  // Stable shape for MaskedTearReplay — memoized so prop identity doesn't change
  // on every Firebase sessionData update, avoiding unnecessary reconciliation.
  const tearSessionData = useMemo(() => {
    if (isSolo || !sessionData) return null
    return {
      tearLine: sessionData.tearLine ?? null,
      players:  sessionData.players  ?? {},
      zones:    sessionData.zones    ?? null,
    }
  }, [isSolo, sessionData?.tearLine, sessionData?.players, sessionData?.zones])

  const displayWidth = Math.min(
    typeof window !== 'undefined' ? window.innerWidth - 32 : 343,
    380,
  )

  function handleClose(e) {
    if (e) e.stopPropagation()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ background: 'rgba(15,10,30,0.88)', backdropFilter: 'blur(6px)' }}
      onClick={handleClose}
    >
      {/* Card — stops click-through */}
      <div
        className="relative flex flex-col items-center gap-5 w-full max-w-lg px-4"
        style={{
          paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
          paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header row */}
        <div className="w-full flex items-center justify-between">
          <h2
            className="text-white text-xl font-semibold"
            style={{ fontFamily: "'Fredoka One', cursive" }}
          >
            ⏩ Replay
          </h2>
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/80 active:scale-90 transition-transform"
            aria-label="Close replay"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content area */}
        {fetchPhase === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="text-4xl animate-bounce" style={{ animationDuration: '0.9s' }}>🎨</div>
            <p className="text-white/60 font-body text-sm">Loading replay…</p>
          </div>
        )}

        {fetchPhase === 'error' && (
          <ReplayUnavailable onClose={handleClose} reason="Could not load strokes. Check your connection." />
        )}

        {fetchPhase === 'ready' && !hasStrokes && (
          <ReplayUnavailable onClose={handleClose} reason="Replay isn't available for this artwork." autoClose onAutoClose={handleClose} />
        )}

        {fetchPhase === 'ready' && hasStrokes && isSolo && (
          <div className="rounded-[28px] overflow-hidden bg-white shadow-xl">
            <TimeLapsePlayer
              strokes={soloStrokes}
              colorPage={colorPage}
              width={displayWidth}
              onComplete={onClose}
            />
          </div>
        )}

        {fetchPhase === 'ready' && hasStrokes && !isSolo && (
          <div className="rounded-[28px] overflow-hidden bg-white shadow-xl">
            <MaskedTearReplay
              allStrokes={allStrokes}
              sessionData={tearSessionData}
              colorPage={colorPage}
              width={displayWidth}
              onComplete={onClose}
            />
          </div>
        )}

        {/* Close button below player */}
        {fetchPhase === 'ready' && hasStrokes && (
          <button
            onClick={handleClose}
            className="w-full max-w-[380px] bg-white/10 text-white font-semibold py-3.5 rounded-2xl font-body text-sm active:scale-95 transition-transform border border-white/20"
          >
            Close
          </button>
        )}
      </div>
    </div>
  )
}

function ReplayUnavailable({ onClose, reason, autoClose, onAutoClose }) {
  useEffect(() => {
    if (!autoClose) return
    const t = setTimeout(() => onAutoClose?.(), 1400)
    return () => clearTimeout(t)
  }, [autoClose, onAutoClose])

  return (
    <div className="flex flex-col items-center gap-4 py-8 px-4 text-center">
      <div className="text-4xl">🎞️</div>
      <p className="text-white/70 font-body text-sm max-w-xs">{reason}</p>
      <button
        onClick={onClose}
        className="bg-white/10 text-white font-semibold py-3 px-8 rounded-2xl font-body text-sm active:scale-95 transition-transform border border-white/20"
      >
        Close
      </button>
    </div>
  )
}
