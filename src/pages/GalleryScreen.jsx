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

// Honest contributor attribution.
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

function ModeBadge({ mode }) {
  if (mode === 'solo') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold font-body"
        style={{ background: '#FFF3D6', color: '#A07010' }}>
        Solo
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold font-body"
      style={{ background: '#EDE8FF', color: '#6B4CF6' }}>
      Together
    </span>
  )
}

function ReplayBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-body"
      style={{ background: '#EEF4FF', color: '#3B6CF6' }}>
      <svg width="7" height="8" viewBox="0 0 8 10" fill="currentColor" aria-hidden="true">
        <path d="M1.5 1.5L7 5L1.5 8.5V1.5Z"/>
      </svg>
      Watch reveal
    </span>
  )
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
  // then load (or reload) the cloud gallery.
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

  // Ownership filter
  const visibleLocal = useMemo(() => {
    if (!user) {
      return artworks.filter(
        a => a.localOwnerType === 'guest' && a.localOwnerId === currentGuestId && !a.migratedToUid
      )
    }
    return artworks.filter(a => {
      if (a.localOwnerType === 'user' && a.localOwnerId === user.uid) return true
      if (a.localOwnerType === 'guest' && a.localOwnerId === currentGuestId) {
        return !a.migratedToUid || a.migratedToUid === user.uid
      }
      return false
    })
  }, [artworks, user, currentGuestId])

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
    loadGallery()
      .filter(a => isSameArtwork(a, deleteTarget))
      .forEach(a => deleteArtwork(a.id))
    setArtworks(loadGallery())
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

  const tearSessionData = hasTearReplay ? {
    tearLine: selected.tearLine,
    players: Object.fromEntries(
      (selected.players || []).map(p => [p.id, { assignedSection: p.assignedSection }])
    ),
  } : null

  const artworkCount = combined.length === 0
    ? '0 artworks'
    : combined.length === 1
    ? '1 artwork'
    : `${combined.length} artworks saved`

  return (
    <motion.div
      className="relative min-h-screen bg-cream overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      {/* ── Background ambiance ────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
        <div className="absolute -top-20 -left-20 w-[340px] h-[340px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(162,110,255,0.16) 0%, rgba(124,62,250,0.06) 45%, transparent 70%)' }} />
        <div className="absolute -top-32 -right-24 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,189,80,0.18) 0%, rgba(255,155,46,0.07) 44%, transparent 70%)' }} />
        <div className="absolute -bottom-16 -right-16 w-[280px] h-[280px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(236,110,170,0.13) 0%, transparent 68%)' }} />
        <div className="absolute -bottom-24 -left-20 w-[360px] h-[360px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(74,158,255,0.15) 0%, rgba(37,99,235,0.05) 45%, transparent 70%)' }} />
        <svg className="absolute top-8 right-8 opacity-[0.09]" width="68" height="68" viewBox="0 0 68 68" fill="none">
          <circle cx="11" cy="11" r="9" fill="#FF9B2E" />
          <circle cx="50" cy="20" r="6" fill="#7C6EFA" />
          <circle cx="20" cy="54" r="7" fill="#4A9EFF" />
          <circle cx="57" cy="55" r="4.5" fill="#EC6EAA" />
        </svg>
        <svg className="absolute bottom-24 left-4 opacity-[0.08]" width="56" height="56" viewBox="0 0 56 56" fill="none">
          <circle cx="9" cy="9" r="8" fill="#FFD07A" />
          <circle cx="40" cy="16" r="5.5" fill="#7C6EFA" />
          <circle cx="16" cy="44" r="6.5" fill="#4A9EFF" />
        </svg>
      </div>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-4xl mx-auto px-5 sm:px-8">

        {/* Header */}
        <div className="pt-10 pb-5 border-b border-ink/6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="w-9 h-9 rounded-full bg-white/80 border border-ink/8 flex items-center justify-center text-ink/50 active:scale-90 transition-transform shadow-sm flex-shrink-0"
              aria-label="Back"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1
                className="text-[22px] leading-tight text-ink"
                style={{ fontFamily: "'Fredoka One', cursive" }}
              >
                Magic Gallery
              </h1>
              <p className="text-ink/42 font-body text-[12px] leading-snug">
                Your finished artworks and reveal replays.
              </p>
            </div>
            <span className="text-ink/30 font-body text-[12px] font-medium flex-shrink-0">
              {artworkCount}
            </span>
          </div>
        </div>

        {/* Sign-in nudge for guests with artworks */}
        {authAvailable && combined.length > 0 && !user && (
          <div className="pt-4">
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
            <div className="relative mb-6">
              <div
                className="w-28 h-28 rounded-[32px] flex items-center justify-center mx-auto"
                style={{
                  background: 'linear-gradient(135deg, #F3D0FF 0%, #EDE8FF 50%, #D6EAFF 100%)',
                  boxShadow: '0 8px 32px rgba(139,110,248,0.20)',
                }}
              >
                <svg width="68" height="68" viewBox="0 0 68 68" fill="none" aria-hidden="true">
                  {/* Frame */}
                  <rect x="4" y="8" width="60" height="48" rx="9" fill="#E8DEFF" stroke="#C4B5FD" strokeWidth="2"/>
                  {/* Canvas */}
                  <rect x="10" y="14" width="48" height="36" rx="6" fill="white"/>
                  {/* Rainbow arcs */}
                  <path d="M15 41 Q34 20 53 41" stroke="#8B6EF8" strokeWidth="3.2" fill="none" strokeLinecap="round"/>
                  <path d="M19 41 Q34 24 49 41" stroke="#4A9EFF" strokeWidth="2.6" fill="none" strokeLinecap="round"/>
                  <path d="M23 41 Q34 28 45 41" stroke="#EC6EAA" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
                  {/* Sparkle - top right */}
                  <path d="M56 9 L57.4 12.5 L61 9 L57.4 5.5 Z" fill="#FFB347"/>
                  {/* Dot accent - top left */}
                  <circle cx="9" cy="10" r="2.5" fill="#FFD07A" opacity="0.7"/>
                  {/* Star - inner top right */}
                  <circle cx="58" cy="22" r="1.8" fill="#8B6EF8" opacity="0.4"/>
                </svg>
              </div>
              {/* Floating dot accents */}
              <div className="absolute -top-2 -right-1 w-4 h-4 rounded-full"
                style={{ background: 'linear-gradient(135deg,#FFB347,#FF9B2E)', opacity: 0.75 }} />
              <div className="absolute -bottom-1 -left-2 w-3 h-3 rounded-full"
                style={{ background: 'linear-gradient(135deg,#8B6EF8,#4A9EFF)', opacity: 0.55 }} />
            </div>
            <h2
              className="text-2xl text-ink mb-2"
              style={{ fontFamily: "'Fredoka One', cursive" }}
            >
              No magic yet
            </h2>
            <p className="text-ink/50 font-body text-sm mb-8 leading-relaxed max-w-[240px]">
              Finish your first coloring page to unlock your gallery.
            </p>
            <button
              onClick={() => navigate('/')}
              className="text-white font-bold px-8 py-3.5 rounded-2xl font-body active:scale-95 transition-transform"
              style={{
                background: 'linear-gradient(135deg, #8B6EF8 0%, #3B6CF6 100%)',
                boxShadow: '0 8px 28px rgba(90,70,240,0.30)',
              }}
            >
              Start coloring
            </button>
          </div>
        )}

        {/* Artwork grid */}
        {combined.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pt-5 pb-12">
            {combined.map((artwork, i) => {
              const hasCardReplay = artwork.strokes?.length > 0 || (artwork.mode === 'tear' && artwork.allStrokes)
              return (
                <motion.div
                  key={artwork.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="relative"
                >
                  <button
                    onClick={() => openArtwork(artwork)}
                    className="w-full text-left active:scale-[0.97] transition-transform"
                  >
                    <div
                      className="bg-white rounded-3xl overflow-hidden"
                      style={{
                        border: '1px solid rgba(139,110,248,0.14)',
                        boxShadow: '0 4px 20px rgba(45,36,22,0.09), 0 0 0 1px rgba(139,110,248,0.06)',
                      }}
                    >
                      {/* Gradient frame accent bar */}
                      <div className="h-[3px] w-full"
                        style={{ background: 'linear-gradient(90deg, #8B6EF8 0%, #4A9EFF 50%, #EC6EAA 100%)' }} />
                      {/* Artwork preview */}
                      <div
                        className="aspect-square mx-3 mt-3 rounded-2xl overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, #F8F3FF 0%, #EEF4FF 100%)' }}
                      >
                        {artwork.finalImageUrl ? (
                          <img
                            src={artwork.finalImageUrl}
                            alt={artwork.name || 'Artwork'}
                            className="w-full h-full object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg width="52" height="52" viewBox="0 0 52 52" fill="none" opacity="0.28" aria-hidden="true">
                              <rect x="2" y="6" width="48" height="40" rx="7" fill="#8B6EF8"/>
                              <rect x="7" y="11" width="38" height="28" rx="5" fill="white"/>
                              <path d="M11 33 Q26 15 41 33" stroke="#8B6EF8" strokeWidth="2.8" fill="none" strokeLinecap="round"/>
                              <path d="M15 33 Q26 19 37 33" stroke="#EC6EAA" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
                            </svg>
                          </div>
                        )}
                      </div>
                      {/* Card info */}
                      <div className="px-3 pt-2.5 pb-3">
                        <div className="font-semibold font-body text-ink text-sm truncate mb-1">
                          {artwork.name || 'My Artwork'}
                        </div>
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <div className="text-ink/45 text-[11px] font-body truncate flex-1">
                            {contributorLabel(artwork)}
                          </div>
                          <div className="text-ink/30 text-[10px] font-body flex-shrink-0">
                            {formatDate(artwork.completedAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <ModeBadge mode={artwork.mode} />
                          {hasCardReplay && <ReplayBadge />}
                        </div>
                      </div>
                    </div>
                  </button>
                  {/* Delete button */}
                  <button
                    onClick={(e) => requestDelete(artwork, e)}
                    className="absolute top-[18px] right-[18px] w-7 h-7 bg-white/90 rounded-full flex items-center justify-center text-ink/30 active:scale-90 transition-transform shadow-sm border border-ink/8"
                    title="Delete"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                    </svg>
                  </button>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Detail overlay (logic unchanged) ─────────────────────────── */}
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
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
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
                      <div className="rounded-3xl bg-gray-800 flex items-center justify-center" style={{ width: displayWidth, height: displayWidth }}>
                        <svg width="64" height="64" viewBox="0 0 68 68" fill="none" opacity="0.3" aria-hidden="true">
                          <rect x="4" y="8" width="60" height="48" rx="9" fill="#8B6EF8"/>
                          <rect x="10" y="14" width="48" height="36" rx="6" fill="white"/>
                        </svg>
                      </div>
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
                    <button
                      onClick={() => { setReplayKey(k => k + 1); setPhase('timelapse') }}
                      className="bg-white/10 text-white font-semibold py-3.5 px-4 rounded-2xl font-body text-sm active:scale-95 transition-transform"
                    >
                      ⏩ Replay
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    className="flex-1 text-white font-bold py-3.5 rounded-2xl shadow-lifted active:scale-95 transition-transform font-body"
                    style={{ background: 'linear-gradient(135deg, #8B6EF8 0%, #3B6CF6 100%)' }}
                  >
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

      {/* ── Delete confirmation dialog ─────────────────────────────────── */}
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
              <div className="flex items-center justify-center mb-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#FEE2E2,#FECACA)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                  </svg>
                </div>
              </div>
              <h3
                className="text-xl text-ink text-center mb-2"
                style={{ fontFamily: "'Fredoka One', cursive" }}
              >
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

      {/* ── Sign-in sheet ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAuth && (
          <AuthModal
            title="Keep your gallery everywhere"
            onClose={() => setShowAuth(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
