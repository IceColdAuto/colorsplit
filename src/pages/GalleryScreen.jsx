import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { loadGallery, deleteArtwork, mergeGalleries, isSameArtwork } from '../lib/gallery'
import {
  loadCloudGallery, deleteCloudArtwork, migrateGuestGalleryToCloud,
} from '../lib/cloudGallery'
import useAuth from '../hooks/useAuth'
import AuthModal from '../components/AuthModal'
import { getPageById } from '../lib/coloringPages'
import { getOrCreatePlayerId } from '../lib/session'
import TimeLapsePlayer from '../components/TimeLapsePlayer'
import MaskedTearReplay from '../components/MaskedTearReplay'

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ModeIcon({ mode }) {
  if (mode === 'solo') return <span title="Solo">🖌️</span>
  if (mode === 'tear') return <span title="Tear mode">✂️</span>
  return <span title="Together">🤝</span>
}

// Honest contributor attribution. The gallery is device-local, so "you" is
// the player id that saved the artwork (falls back to the current device id
// for artworks saved before savedByPlayerId existed).
function contributorLabel(artwork) {
  const myId = artwork.savedByPlayerId || getOrCreatePlayerId()
  const others = (artwork.players || []).filter(p => p.id !== myId && p.name)
  if (artwork.mode === 'solo' || others.length === 0) return 'Made by you'
  const names = others.map(p => p.name)
  const leftIds = new Set(artwork.leftPlayerIds || [])
  const someoneLeft = artwork.status === 'completed_after_leave'
    || others.some(p => p.left || leftIds.has(p.id))
  if (someoneLeft) return `Started with ${names.join(' & ')} · Finished by you`
  return `Made with ${names.join(' & ')}`
}

export default function GalleryScreen() {
  const navigate = useNavigate()
  const [artworks, setArtworks] = useState([])
  const [selected, setSelected] = useState(null)
  const [phase, setPhase] = useState('timelapse')
  const [replayKey, setReplayKey] = useState(0)
  const [shareMsg, setShareMsg] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const { user, profile, authAvailable } = useAuth()
  const [cloudArtworks, setCloudArtworks] = useState([])
  const [showAuth, setShowAuth] = useState(false)
  const currentGuestId = useMemo(() => getOrCreatePlayerId(), [])

  useEffect(() => {
    setArtworks(loadGallery())
  }, [])

  // Account gallery: on sign-in, auto-migrate eligible guest artworks silently,
  // then load (or reload) the cloud gallery. No user prompt needed.
  useEffect(() => {
    if (!user) { setCloudArtworks([]); return }
    let cancelled = false
    loadCloudGallery(user.uid)
      .then(list => { if (!cancelled) setCloudArtworks(list) })
      .catch(() => {})
    migrateGuestGalleryToCloud(user.uid)
      .then(() => loadCloudGallery(user.uid))
      .then(list => { if (!cancelled) setCloudArtworks(list) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user])

  // Ownership filter:
  //   Signed out: current-guestId guest entries only. Legacy/null-owner hidden.
  //   Signed in:  own uid's local entries, PLUS current-guestId guest entries
  //               that are eligible for this account (not migrated to another uid).
  //               Keeping guest entries visible prevents a flash-of-empty while
  //               auto-migration is in flight and preserves the local replay copy
  //               as the source of truth after migration (cloud stores no strokes).
  //               mergeGalleries deduplicates local vs cloud copies by id.
  const visibleLocal = useMemo(() => {
    if (!user) {
      return artworks.filter(
        a => a.localOwnerType === 'guest' && a.localOwnerId === currentGuestId && !a.migratedToUid
      )
    }
    return artworks.filter(a => {
      if (a.localOwnerType === 'user' && a.localOwnerId === user.uid) return true
      if (a.localOwnerType === 'guest' && a.localOwnerId === currentGuestId) {
        // Hide only if already migrated to a different account.
        return !a.migratedToUid || a.migratedToUid === user.uid
      }
      return false
    })
  }, [artworks, user, currentGuestId])

  // One card per finished artwork: local replay copies win over their cloud
  // thumbnail twins, matched by id / recorded cloud id / same session round.
  const combined = useMemo(
    () => mergeGalleries(visibleLocal, cloudArtworks),
    [visibleLocal, cloudArtworks],
  )

  function openArtwork(artwork) {
    setSelected(artwork)
    setReplayKey(0)
    setShareMsg('')
    const hasTear = artwork.mode === 'tear' && artwork.allStrokes && artwork.tearLine
    const hasSolo = artwork.strokes?.length > 0
    setPhase(hasTear || hasSolo ? 'timelapse' : 'reveal')
  }

  function closeDetail() {
    setSelected(null)
    setPhase('timelapse')
  }

  function handleTimeLapseComplete() {
    setTimeout(() => setPhase('reveal'), 400)
  }

  function handleSave() {
    if (!selected?.finalImageUrl) return
    const a = document.createElement('a')
    a.download = `${selected.name || 'colorsplit-artwork'}.png`
    a.href = selected.finalImageUrl
    a.click()
  }

  async function handleShare() {
    const url = window.location.origin
    try {
      if (selected?.finalImageUrl && navigator.canShare?.({ files: [] })) {
        const res = await fetch(selected.finalImageUrl)
        const blob = await res.blob()
        const file = new File([blob], 'colorsplit.png', { type: 'image/png' })
        await navigator.share({ title: `${selected.name || 'My ColorSplit artwork'}!`, files: [file] })
      } else if (navigator.share) {
        await navigator.share({ title: 'ColorSplit', url })
      } else {
        await navigator.clipboard.writeText(url)
        setShareMsg('Copied!')
        setTimeout(() => setShareMsg(''), 2500)
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url)
        setShareMsg('Copied!')
        setTimeout(() => setShareMsg(''), 2500)
      } catch {}
    }
  }

  function requestDelete(artwork, e) {
    e.stopPropagation()
    setDeleteTarget(artwork)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    // Delete the whole duplicate group — otherwise removing the visible card
    // would just reveal a hidden local/cloud twin of the same artwork.
    loadGallery()
      .filter(a => isSameArtwork(a, deleteTarget))
      .forEach(a => deleteArtwork(a.id))
    setArtworks(loadGallery())
    // Remove the account copies too — "Delete" means gone everywhere.
    if (user) {
      const cloudTwins = cloudArtworks.filter(a => isSameArtwork(a, deleteTarget))
      if (cloudTwins.length > 0) {
        Promise.all(cloudTwins.map(a => deleteCloudArtwork(user.uid, a.id)))
          .then(() => loadCloudGallery(user.uid).then(setCloudArtworks))
          .catch(() => {})
      }
    }
    if (selected?.id === deleteTarget.id) closeDetail()
    setDeleteTarget(null)
  }

  const colorPage = selected ? getPageById(selected.pageId) : null
  const displayWidth = Math.min(typeof window !== 'undefined' ? window.innerWidth - 48 : 327, 360)

  const hasTearReplay = selected?.mode === 'tear' && !!selected?.allStrokes && !!selected?.tearLine
  const hasSoloReplay = !hasTearReplay && (selected?.strokes?.length > 0)
  const hasReplay = hasTearReplay || hasSoloReplay

  // Reconstruct the sessionData shape MaskedTearReplay expects
  const tearSessionData = hasTearReplay ? {
    tearLine: selected.tearLine,
    players: Object.fromEntries(
      (selected.players || []).map(p => [p.id, { assignedSection: p.assignedSection }])
    ),
  } : null

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 pt-10 pb-5 border-b border-ink/6">
        <button onClick={() => navigate('/')} className="text-ink/50 text-lg active:scale-90 transition-transform">←</button>
        <h1 className="font-display text-2xl text-ink flex-1" style={{ fontFamily: "'Fredoka One', cursive" }}>
          Gallery
        </h1>
        <span className="text-ink/30 font-body text-sm">{combined.length} artwork{combined.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Sign-in nudge for guests with artworks */}
      {authAvailable && combined.length > 0 && !user && (
        <div className="px-6 pt-4">
          <button
            onClick={() => setShowAuth(true)}
            className="w-full bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 text-left active:scale-[0.98] transition-transform"
          >
            <span className="font-body text-[13px] text-blue-700">
              <strong>Saved on this device only.</strong> Create a free account to keep your gallery across devices →
            </span>
          </button>
        </div>
      )}

      {/* Empty state */}
      {combined.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[65vh] px-8 text-center">
          <div className="text-7xl mb-5">🖼️</div>
          <h2 className="font-display text-2xl text-ink mb-2" style={{ fontFamily: "'Fredoka One', cursive" }}>
            No artworks yet
          </h2>
          <p className="text-ink/50 font-body text-sm mb-8 leading-relaxed">
            Finish a coloring session to see your<br />artwork here — with a timelapse replay!
          </p>
          <button onClick={() => navigate('/')} className="bg-blue-500 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lifted active:scale-95 transition-transform font-body">
            Start Coloring 🎨
          </button>
        </div>
      )}

      {/* Grid */}
      {combined.length > 0 && (
        <div className="grid grid-cols-2 gap-4 px-6 pt-5 pb-10">
          {combined.map((artwork, i) => (
            <motion.div
              key={artwork.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative"
            >
              <button
                onClick={() => openArtwork(artwork)}
                className="w-full bg-white rounded-3xl shadow-paper overflow-hidden text-left active:scale-95 transition-transform border border-ink/5"
              >
                <div className="aspect-square bg-gray-50">
                  {artwork.finalImageUrl ? (
                    <img src={artwork.finalImageUrl} alt={artwork.name || 'Artwork'} className="w-full h-full object-contain" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl opacity-30">🎨</div>
                  )}
                </div>
                <div className="p-3">
                  <div className="font-semibold font-body text-ink text-sm truncate mb-0.5">
                    {artwork.name || 'My Artwork'}
                  </div>
                  <div className="text-ink/55 text-[11px] font-body truncate mb-0.5">
                    {contributorLabel(artwork)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ModeIcon mode={artwork.mode} />
                    <span className="text-ink/40 text-xs font-body">{formatDate(artwork.completedAt)}</span>
                  </div>
                  {(artwork.strokes?.length > 0 || (artwork.mode === 'tear' && artwork.allStrokes)) && (
                    <div className="text-blue-400 text-xs font-body mt-0.5">▶ Replay</div>
                  )}
                </div>
              </button>
              {/* Delete button on thumbnail */}
              <button
                onClick={(e) => requestDelete(artwork, e)}
                className="absolute top-2 right-2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center text-ink/30 active:scale-90 transition-transform shadow-sm"
                title="Delete"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                </svg>
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail overlay */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key="detail"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#111] flex flex-col z-50"
          >
            <div className="flex items-center justify-between px-6 pt-10 pb-3 flex-shrink-0">
              <button onClick={closeDetail} className="text-white/55 font-body text-sm active:scale-90 transition-transform">
                ← Back
              </button>
              <div className="flex-1 text-center">
                <span className="text-white/70 font-body text-sm font-semibold truncate px-2">
                  {selected.name || 'My Artwork'}
                </span>
              </div>
              <button
                onClick={(e) => requestDelete(selected, e)}
                className="text-white/30 active:scale-90 transition-transform p-1"
                title="Delete"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                </svg>
              </button>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
              <AnimatePresence mode="wait">
                {phase === 'timelapse' ? (
                  <motion.div key="timelapse" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} className="mx-auto">
                    {hasTearReplay ? (
                      <MaskedTearReplay
                        key={replayKey}
                        allStrokes={selected.allStrokes}
                        sessionData={tearSessionData}
                        colorPage={colorPage}
                        width={displayWidth}
                        onComplete={handleTimeLapseComplete}
                      />
                    ) : (
                      <TimeLapsePlayer
                        key={replayKey}
                        strokes={selected.strokes || []}
                        colorPage={colorPage}
                        width={displayWidth}
                        onComplete={handleTimeLapseComplete}
                      />
                    )}
                    <p className="text-white/35 font-body text-xs text-center mt-3">
                      {contributorLabel(selected)}
                    </p>
                  </motion.div>
                ) : (
                  <motion.div key="reveal" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 22 }} className="mx-auto">
                    {selected.finalImageUrl ? (
                      <img src={selected.finalImageUrl} alt="Artwork" className="rounded-3xl shadow-deep" style={{ width: displayWidth, height: displayWidth, objectFit: 'contain' }} />
                    ) : (
                      <div className="rounded-3xl bg-gray-800 flex items-center justify-center text-6xl" style={{ width: displayWidth, height: displayWidth }}>🎨</div>
                    )}
                    <p className="text-white/35 font-body text-xs text-center mt-3">
                      {contributorLabel(selected)} · {formatDate(selected.completedAt)}
                    </p>
                    {!hasReplay && (
                      <p className="text-white/25 font-body text-xs text-center mt-1">Replay unavailable for this artwork.</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="px-6 pb-10 flex-shrink-0">
              {phase === 'timelapse' && (
                <button onClick={() => setPhase('reveal')} className="w-full text-white/40 font-body text-sm py-3 active:scale-95 transition-transform">
                  Skip to final →
                </button>
              )}
              {phase === 'reveal' && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                  {hasReplay && (
                    <button onClick={() => { setReplayKey(k => k + 1); setPhase('timelapse') }} className="bg-white/10 text-white font-semibold py-3.5 px-4 rounded-2xl font-body text-sm active:scale-95 transition-transform">
                      ⏩ Replay
                    </button>
                  )}
                  <button onClick={handleSave} className="flex-1 bg-blue-500 text-white font-bold py-3.5 rounded-2xl shadow-lifted active:scale-95 transition-transform font-body">
                    💾 Save PNG
                  </button>
                  <button onClick={handleShare} className="bg-white/10 text-white font-semibold py-3.5 px-4 rounded-2xl font-body text-sm active:scale-95 transition-transform">
                    {shareMsg || '🔗'}
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/60 backdrop-blur-sm flex items-center justify-center z-[60] px-6"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              onClick={e => e.stopPropagation()}
              className="bg-cream rounded-3xl p-6 w-full max-w-sm shadow-deep"
            >
              <div className="text-4xl text-center mb-3">🗑️</div>
              <h3 className="font-display text-xl text-ink text-center mb-2" style={{ fontFamily: "'Fredoka One', cursive" }}>
                Delete artwork?
              </h3>
              <p className="text-ink/50 font-body text-sm text-center mb-6 leading-relaxed">
                Are you sure you want to delete <strong className="text-ink/70">"{deleteTarget.name || 'this artwork'}"</strong>?
                This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 bg-white text-ink font-semibold py-3.5 rounded-2xl border border-ink/10 font-body active:scale-95 transition-transform"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 bg-red-500 text-white font-bold py-3.5 rounded-2xl font-body active:scale-95 transition-transform"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sign-in sheet */}
      <AnimatePresence>
        {showAuth && (
          <AuthModal
            title="Keep your gallery everywhere"
            onClose={() => setShowAuth(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
