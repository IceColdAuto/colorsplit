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

function contributorLabel(artwork) {
  const myId = artwork.savedByPlayerId || getOrCreatePlayerId()
  const others = (artwork.players || []).filter(p => p.id !== myId && p.name)
  const isTogether = artwork.mode === 'tear' || artwork.mode === 'together'
  if (!isTogether || others.length === 0) return isTogether ? 'Colored together' : 'Colored by you'
  const names = others.map(p => p.name)
  const leftIds = new Set(artwork.leftPlayerIds || [])
  const someoneLeft = artwork.status === 'completed_after_leave'
    || others.some(p => p.left || leftIds.has(p.id))
  if (someoneLeft) return `Colored with ${names.join(' & ')} · Finished by you`
  return `Colored with ${names.join(' & ')}`
}

function ModeBadge({ mode }) {
  if (mode === 'solo') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold font-body"
        style={{ background: '#FFF3D6', color: '#9A6B00' }}>
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

export default function GalleryScreen() {
  const navigate = useNavigate()
  const [artworks, setArtworks] = useState([])
  const [selected, setSelected] = useState(null)
  const [phase, setPhase] = useState('timelapse')
  const [replayKey, setReplayKey] = useState(0)
  const [shareMsg, setShareMsg] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const { user, authAvailable } = useAuth()
  const [cloudArtworks, setCloudArtworks] = useState([])
  const [cloudLoading, setCloudLoading] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const currentGuestId = useMemo(() => getOrCreatePlayerId(), [])

  useEffect(() => {
    setArtworks(loadGallery())
  }, [])

  useEffect(() => {
    if (!user) { setCloudArtworks([]); setCloudLoading(false); return }
    let cancelled = false
    setCloudLoading(true)
    loadCloudGallery(user.uid)
      .then(list => { if (!cancelled) setCloudArtworks(list) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCloudLoading(false) })
    migrateGuestGalleryToCloud(user.uid)
      .then(() => loadCloudGallery(user.uid))
      .then(list => { if (!cancelled) setCloudArtworks(list) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user])

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
    setPhase('reveal')
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
  const displayWidth = Math.min(typeof window !== 'undefined' ? window.innerWidth - 32 : 343, 380)

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
    ? null
    : combined.length === 1
    ? '1 saved page'
    : `${combined.length} saved pages`

  return (
    <motion.div
      className="relative min-h-screen bg-cream overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      {/* ── Background ambiance ─────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
        <div className="absolute -top-20 -left-20 w-[380px] h-[380px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(147,210,255,0.14) 0%, rgba(74,158,255,0.04) 45%, transparent 70%)' }} />
        <div className="absolute -top-28 -right-20 w-[420px] h-[420px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,192,220,0.22) 0%, rgba(236,110,170,0.06) 44%, transparent 70%)' }} />
        <div className="absolute -bottom-14 -right-14 w-[300px] h-[300px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(210,192,255,0.16) 0%, transparent 68%)' }} />
        <div className="absolute -bottom-20 -left-16 w-[340px] h-[340px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(147,210,255,0.11) 0%, rgba(74,158,255,0.03) 45%, transparent 70%)' }} />
        <svg className="absolute top-10 right-10 opacity-[0.09]" width="64" height="64" viewBox="0 0 64 64" fill="none">
          <circle cx="10" cy="10" r="8" fill="#93D2FF" />
          <circle cx="47" cy="18" r="5.5" fill="#C4ABFF" />
          <circle cx="18" cy="51" r="6.5" fill="#93D2FF" />
          <circle cx="54" cy="52" r="4" fill="#FFB6D5" />
        </svg>
        <svg className="absolute bottom-28 left-5 opacity-[0.07]" width="52" height="52" viewBox="0 0 52 52" fill="none">
          <circle cx="8" cy="8" r="7" fill="#93D2FF" />
          <circle cx="38" cy="14" r="5" fill="#C4ABFF" />
          <circle cx="14" cy="42" r="6" fill="#FFB6D5" />
        </svg>
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-8">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="pt-10 pb-5 border-b border-ink/6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="w-9 h-9 rounded-full bg-white/80 border border-ink/8 flex items-center justify-center text-ink/50 active:scale-90 transition-transform shadow-sm flex-shrink-0"
              aria-label="Back"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            {/* Gallery mark + title */}
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              {/* Tiny framed gallery mark */}
              <div className="flex-shrink-0 w-8 h-8 rounded-[10px] flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #EDE0FF 0%, #D8CCFF 100%)', boxShadow: '0 2px 8px rgba(139,110,248,0.22)' }}>
                <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                  <rect x="0.5" y="0.5" width="21" height="21" rx="5.5" fill="#EDE0FF" stroke="#C4ABFF" strokeWidth="1.2"/>
                  <rect x="3" y="3" width="16" height="16" rx="3.5" fill="#FFFDF8"/>
                  <path d="M5 16.5 Q11 6.5 17 16.5" stroke="#8B6EF8" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
                  <path d="M6.5 16.5 Q11 9.5 15.5 16.5" stroke="#4A9EFF" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                  <path d="M8 16.5 Q11 12 14 16.5" stroke="#EC6EAA" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
                  <circle cx="4.5" cy="4.5" r="1" fill="#FFD07A" opacity="0.9"/>
                  <path d="M17.5 3 L18 4.2 L19.2 3 L18 1.8 Z" fill="#FFB347"/>
                </svg>
              </div>

              <div>
                <h1 className="text-[21px] leading-tight"
                  style={{ fontFamily: "'Fredoka One', cursive", color: '#4A326F' }}>
                  My Gallery
                </h1>
                <p className="font-body text-[11px] leading-none mt-0.5"
                  style={{ color: '#8A7C91' }}>
                  Your finished coloring adventures.
                </p>
              </div>
            </div>

            {user && cloudLoading && (
              <span className="font-body text-[11px] font-medium flex-shrink-0 px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(210,192,255,0.20)', color: '#8B6EF8' }}>
                Syncing…
              </span>
            )}
            {artworkCount && (
              <span className="font-body text-[11px] font-medium flex-shrink-0 px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(147,210,255,0.18)', color: '#5A8FAA' }}>
                {artworkCount}
              </span>
            )}
          </div>
        </div>

        {/* Sign-in nudge */}
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

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {combined.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[65vh] px-8 text-center">
            {/* Framed gallery icon — large empty state version */}
            <div className="relative mb-7">
              <div
                className="w-[120px] h-[120px] rounded-[36px] flex items-center justify-center mx-auto"
                style={{
                  background: 'linear-gradient(145deg, #F0E8FF 0%, #E8DEFF 40%, #DCEEFF 100%)',
                  boxShadow: '0 6px 36px rgba(139,110,248,0.22), 0 2px 10px rgba(139,110,248,0.10)',
                }}
              >
                <svg width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
                  {/* Outer frame — premium double-border feel */}
                  <rect x="2" y="5" width="68" height="58" rx="10" fill="#E8DCFF" stroke="#C4ABFF" strokeWidth="2"/>
                  <rect x="4.5" y="7.5" width="63" height="53" rx="8" fill="none" stroke="rgba(196,171,255,0.4)" strokeWidth="1"/>
                  {/* Inner mat (warm cream-white canvas) */}
                  <rect x="9" y="12" width="54" height="43" rx="6" fill="#FFFEF9"/>
                  {/* Art scene — three ColorSplit arcs */}
                  <path d="M14 48 Q36 22 58 48" stroke="#8B6EF8" strokeWidth="3.4" fill="none" strokeLinecap="round"/>
                  <path d="M18 48 Q36 27 54 48" stroke="#4A9EFF" strokeWidth="2.8" fill="none" strokeLinecap="round"/>
                  <path d="M22 48 Q36 31 50 48" stroke="#EC6EAA" strokeWidth="2.4" fill="none" strokeLinecap="round"/>
                  {/* Small sun/dot in top-left of canvas */}
                  <circle cx="16" cy="20" r="3.5" fill="#FFD07A" opacity="0.75"/>
                  <circle cx="16" cy="20" r="1.8" fill="#FFBC00" opacity="0.9"/>
                  {/* Sparkle top-right on frame */}
                  <path d="M61 7 L62.2 10.2 L65 7 L62.2 3.8 Z" fill="#FFB347"/>
                  {/* Tiny star bottom-left frame corner */}
                  <path d="M8 56 L8.8 58 L10.6 56 L8.8 54 Z" fill="#FFB347" opacity="0.6"/>
                </svg>
              </div>
              {/* Floating color dots */}
              <div className="absolute -top-2 -right-1 w-4 h-4 rounded-full"
                style={{ background: 'linear-gradient(135deg, #FFB347, #FF9B2E)', opacity: 0.80 }} />
              <div className="absolute top-3 -right-4 w-2.5 h-2.5 rounded-full"
                style={{ background: '#8B6EF8', opacity: 0.40 }} />
              <div className="absolute -bottom-1 -left-2 w-3.5 h-3.5 rounded-full"
                style={{ background: 'linear-gradient(135deg, #8B6EF8, #4A9EFF)', opacity: 0.50 }} />
            </div>

            <h2
              className="text-[26px] text-ink mb-2"
              style={{ fontFamily: "'Fredoka One', cursive" }}
            >
              No magic yet
            </h2>
            <p className="text-ink/48 font-body text-sm mb-8 leading-relaxed max-w-[230px]">
              Finish your first coloring page to unlock your gallery.
            </p>
            <button
              onClick={() => navigate('/')}
              className="text-white font-bold px-9 py-3.5 rounded-[18px] font-body active:scale-95 transition-transform"
              style={{
                background: 'linear-gradient(135deg, #8B6EF8 0%, #3B6CF6 100%)',
                boxShadow: '0 8px 28px rgba(90,70,240,0.30), 0 2px 8px rgba(90,70,240,0.18)',
              }}
            >
              Start coloring
            </button>
          </div>
        )}

        {/* ── Artwork grid ─────────────────────────────────────────────────── */}
        {combined.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-6 pb-14">
            {combined.map((artwork, i) => {
              const hasCardReplay = artwork.strokes?.length > 0 || (artwork.mode === 'tear' && artwork.allStrokes)
              return (
                <motion.div
                  key={artwork.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, type: 'spring', stiffness: 280, damping: 26 }}
                  className="relative"
                >
                  {/* ── Card — entire area opens the artwork ─────────────── */}
                  <button
                    onClick={() => openArtwork(artwork)}
                    className="w-full text-left active:scale-[0.97] transition-transform"
                  >
                    <div
                      className="rounded-[22px] overflow-hidden"
                      style={{
                        background: '#FFFEFA',
                        border: '1.5px solid rgba(200,175,130,0.16)',
                        boxShadow: '0 2px 12px rgba(45,36,22,0.08), 0 8px 28px rgba(45,36,22,0.05), 0 0 0 1px rgba(200,175,130,0.08)',
                      }}
                    >
                      {/* ── Framed artwork preview ── */}
                      {/* The outer card's cream bg shows through as the "mat board" */}
                      <div className="px-3.5 pt-3.5">
                        <div
                          className="aspect-square rounded-[14px] overflow-hidden"
                          style={{
                            background: 'linear-gradient(145deg, #F9F5FF 0%, #F0F6FF 100%)',
                            boxShadow: 'inset 0 0 0 1px rgba(170,140,90,0.12), inset 0 2px 8px rgba(45,36,22,0.06)',
                          }}
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
                              <svg width="54" height="54" viewBox="0 0 60 60" fill="none" opacity="0.22" aria-hidden="true">
                                <rect x="2" y="5" width="56" height="46" rx="8" fill="#8B6EF8"/>
                                <rect x="7" y="10" width="46" height="35" rx="5.5" fill="#FFFEF9"/>
                                <path d="M12 38 Q30 16 48 38" stroke="#8B6EF8" strokeWidth="3" fill="none" strokeLinecap="round"/>
                                <path d="M16 38 Q30 20 44 38" stroke="#4A9EFF" strokeWidth="2.4" fill="none" strokeLinecap="round"/>
                                <path d="M20 38 Q30 24 40 38" stroke="#EC6EAA" strokeWidth="2" fill="none" strokeLinecap="round"/>
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── Card footer ── */}
                      {/* pr-9 leaves space for the delete button positioned below */}
                      <div className="px-3.5 pt-2.5 pb-[46px] pr-4">
                        <div className="font-bold font-body text-ink text-[13px] truncate mb-0.5">
                          {artwork.name || 'My Artwork'}
                        </div>
                        <div className="text-ink/42 text-[10px] font-body truncate mb-2">
                          {contributorLabel(artwork)} · {formatDate(artwork.completedAt)}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <ModeBadge mode={artwork.mode} />
                          {hasCardReplay && (
                            <div
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-white leading-none"
                              style={{
                                background: 'linear-gradient(135deg, #F07260 0%, #EC6EAA 100%)',
                                boxShadow: '0 2px 8px rgba(240,114,96,0.28)',
                              }}
                            >
                              <svg width="7" height="8" viewBox="0 0 8 10" fill="currentColor" aria-hidden="true">
                                <path d="M1.5 1.5L7 5L1.5 8.5V1.5Z"/>
                              </svg>
                              Replay
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* ── Delete — in footer zone, not over the artwork ────── */}
                  <button
                    onClick={(e) => requestDelete(artwork, e)}
                    className="absolute bottom-[13px] right-[14px] w-8 h-8 rounded-full flex items-center justify-center text-ink/18 active:text-ink/50 active:bg-ink/6 transition-colors"
                    title="Delete artwork"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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

      {/* ── Detail overlay ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key="detail"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex flex-col z-50"
            style={{ background: 'linear-gradient(160deg, #fdfcfb 0%, #f7f4ff 100%)' }}
          >
            {/* Soft pastel glow centered on artwork */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'radial-gradient(ellipse 85% 52% at 50% 44%, rgba(139,110,248,0.09) 0%, transparent 68%)'
            }} />

            {/* Top bar */}
            <div className="relative z-10 flex items-center justify-between px-6 pt-10 pb-3 flex-shrink-0">
              <button onClick={closeDetail} className="text-ink/55 font-body text-sm active:scale-90 transition-transform">
                ← Back
              </button>
              <div className="flex-1 text-center">
                <span className="text-ink/70 font-body text-sm font-semibold truncate px-2">
                  {selected.name || 'My Artwork'}
                </span>
              </div>
              <button
                onClick={(e) => requestDelete(selected, e)}
                className="text-ink/28 active:text-ink/55 transition-colors p-1"
                title="Delete"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                </svg>
              </button>
            </div>

            {/* Single centered composition — artwork + caption + actions as one unit */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 pb-8">
              <AnimatePresence mode="wait">
                {phase === 'timelapse' ? (
                  <motion.div key="timelapse" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} className="flex flex-col items-center">
                    <div className="rounded-[28px] p-2 bg-white" style={{ boxShadow: '0 8px 36px rgba(139,110,248,0.14), 0 2px 10px rgba(0,0,0,0.07)' }}>
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
                    </div>
                    <p className="text-ink/45 font-body text-xs text-center mt-3">
                      {contributorLabel(selected)}
                    </p>
                  </motion.div>
                ) : (
                  <motion.div key="reveal" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 22 }} className="flex flex-col items-center w-full">
                    <div className="rounded-[28px] p-2 bg-white" style={{ boxShadow: '0 8px 36px rgba(139,110,248,0.14), 0 2px 10px rgba(0,0,0,0.07)' }}>
                      {selected.finalImageUrl ? (
                        <img src={selected.finalImageUrl} alt="Artwork" className="rounded-3xl" style={{ width: displayWidth, height: displayWidth, objectFit: 'contain' }} />
                      ) : (
                        <div className="rounded-3xl bg-gray-100 flex items-center justify-center" style={{ width: displayWidth, height: displayWidth }}>
                          <svg width="60" height="60" viewBox="0 0 72 72" fill="none" opacity="0.25" aria-hidden="true">
                            <rect x="2" y="5" width="68" height="58" rx="10" fill="#8B6EF8"/>
                            <rect x="9" y="12" width="54" height="43" rx="6" fill="white"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <p className="text-ink/45 font-body text-xs text-center mt-3">
                      {contributorLabel(selected)} · {formatDate(selected.completedAt)}
                    </p>
                    {!hasReplay && (
                      <p className="text-ink/30 font-body text-xs text-center mt-1">Replay unavailable for this artwork.</p>
                    )}
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 mt-5 max-w-sm w-full">
                      {hasReplay && (
                        <button
                          onClick={() => { setReplayKey(k => k + 1); setPhase('timelapse') }}
                          className="bg-black/[0.06] text-ink font-semibold py-3 px-4 rounded-2xl font-body text-sm active:scale-95 transition-transform whitespace-nowrap"
                        >
                          ⏩ Replay
                        </button>
                      )}
                      <button
                        onClick={handleSave}
                        className="flex-1 text-white font-bold py-3 rounded-2xl active:scale-95 transition-transform font-body text-sm"
                        style={{ background: 'linear-gradient(135deg, #8B6EF8 0%, #3B6CF6 100%)', boxShadow: '0 4px 18px rgba(90,70,240,0.28)' }}
                      >
                        💾 Save PNG
                      </button>
                      <button onClick={handleShare} className="bg-black/[0.06] text-ink font-semibold py-3 px-4 rounded-2xl font-body text-sm active:scale-95 transition-transform">
                        {shareMsg || '🔗'}
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete confirmation ─────────────────────────────────────────── */}
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
              className="bg-cream rounded-3xl p-6 w-full max-w-sm"
              style={{ boxShadow: '0 24px 64px rgba(45,36,22,0.28)' }}
            >
              <div className="flex items-center justify-center mb-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%)' }}>
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                  </svg>
                </div>
              </div>
              <h3 className="text-xl text-ink text-center mb-2"
                style={{ fontFamily: "'Fredoka One', cursive" }}>
                Delete artwork?
              </h3>
              <p className="text-ink/50 font-body text-sm text-center mb-6 leading-relaxed">
                Are you sure you want to delete{' '}
                <strong className="text-ink/70">"{deleteTarget.name || 'this artwork'}"</strong>?
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

      {/* ── Sign-in sheet ────────────────────────────────────────────────── */}
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
