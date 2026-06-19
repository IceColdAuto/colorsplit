import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { logBetaEvent } from '../lib/analytics'
import { getPageById } from '../lib/coloringPages'
import {
  subscribeToSession,
  getOrCreatePlayerId,
  getOrCreatePlayerName,
  setPlayerWantsAgain,
  leaveRoom,
  resetRound,
  createSession,
} from '../lib/session'
import { getProfile } from '../lib/profile'
import { saveArtwork, compressImageDataUrl, markArtworkMigrated, loadGallery } from '../lib/gallery'
import { saveArtworkToCloud } from '../lib/cloudGallery'
import useAuth from '../hooks/useAuth'
import ReplayModal from '../components/ReplayModal'

const CANVAS_SIZE = 800

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 60)}`))
    img.src = src
  })
}

async function buildColorTogetherImage(players, colorPage) {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_SIZE
  canvas.height = CANVAS_SIZE
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  for (const player of players) {
    const img = await loadImage(player.canvasSnapshotUrl)
    ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
  }

  if (colorPage) {
    await new Promise(resolve => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      const onDraw = () => {
        ctx.save()
        ctx.globalCompositeOperation = 'multiply'
        ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
        ctx.restore()
        resolve()
      }
      img.onerror = () => resolve()
      if (colorPage.svgContent) {
        const blob = new Blob([colorPage.svgContent], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(blob)
        img.onload = () => { onDraw(); URL.revokeObjectURL(url) }
        img.src = url
      } else if (colorPage.uploadDataUrl || colorPage.imageUrl) {
        img.onload = onDraw
        img.src = colorPage.uploadDataUrl || colorPage.imageUrl
      } else {
        resolve()
      }
    })
  }

  return canvas.toDataURL('image/png')
}

// ── Confetti ──────────────────────────────────────────────────────────────────
const CONFETTI_COLORS = ['#8B6EF8', '#FF6B9D', '#FFD93D', '#6BCB77', '#4DAAFF', '#FF9A3C']

function generateParticles(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 1.4,
    duration: 2.2 + Math.random() * 1.6,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 7 + Math.random() * 10,
    isCircle: Math.random() > 0.5,
  }))
}

function Confetti() {
  const particles = useMemo(() => generateParticles(140), [])
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 50 }}>
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: 0,
            width: p.isCircle ? p.size : p.size * 0.55,
            height: p.isCircle ? p.size : p.size * 1.5,
            borderRadius: p.isCircle ? '50%' : '2px',
            backgroundColor: p.color,
            animation: `csConfettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
    </div>
  )
}

// ── Decorative bubbles ────────────────────────────────────────────────────────
// Positioned relative to the artwork square wrapper (aspectRatio:1).
// Negative values place them outside the artwork edge.
const BUBBLE_DEFS = [
  { style: { left: '-6%',  top: '14%'    }, size: 13, color: '#8B6EF8', duration: 3.2, delay: 0   },
  { style: { left: '-8%',  top: '62%'    }, size: 19, color: '#FF6B9D', duration: 2.8, delay: 0.5 },
  { style: { right: '-7%', top: '22%'    }, size: 15, color: '#FFD93D', duration: 3.5, delay: 0.3 },
  { style: { right: '-5%', top: '68%'    }, size: 11, color: '#6BCB77', duration: 2.6, delay: 0.8 },
  { style: { left: '14%',  top: '-6%'    }, size: 17, color: '#4DAAFF', duration: 3.1, delay: 0.2 },
  { style: { right: '20%', top: '-5%'    }, size: 12, color: '#FF9A3C', duration: 2.9, delay: 0.6 },
  { style: { left: '42%',  bottom: '-6%' }, size: 14, color: '#8B6EF8', duration: 3.3, delay: 0.4 },
  { style: { right: '8%',  bottom: '-5%' }, size: 10, color: '#FF6B9D', duration: 2.7, delay: 0.9 },
]

function ArtworkBubbles() {
  return (
    <>
      {BUBBLE_DEFS.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            ...b.style,
            width: b.size,
            height: b.size,
            borderRadius: '50%',
            backgroundColor: b.color,
            opacity: 0.7,
            pointerEvents: 'none',
            zIndex: 0,
            animation: `csBubbleFloat ${b.duration}s ${b.delay}s ease-in-out infinite`,
          }}
        />
      ))}
    </>
  )
}

// ── CSS keyframes ─────────────────────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes csConfettiFall {
    0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
    80%  { opacity: 0.9; }
    100% { transform: translateY(108vh) rotate(560deg); opacity: 0; }
  }
  @keyframes csRevealPop {
    from { opacity: 0; transform: scale(0.93); }
    to   { opacity: 1; transform: scale(1);    }
  }
  @keyframes csBubbleFloat {
    0%, 100% { transform: translateY(0px)   scale(1);    opacity: 0.7;  }
    50%       { transform: translateY(-10px) scale(1.08); opacity: 0.95; }
  }
`

const ART_SHADOW = '0 0 32px rgba(124,92,255,0.18), 0 8px 20px rgba(0,0,0,0.07)'

// Artwork frame: wrapper has aspectRatio:1 so bubble bottom/top % values resolve.
function ArtFrame({ children, animate }) {
  return (
    <div
      className="w-full max-w-[340px]"
      style={{ aspectRatio: '1', position: 'relative' }}
    >
      <ArtworkBubbles />
      <div
        className="rounded-3xl overflow-hidden bg-white"
        style={{
          position: 'absolute',
          inset: 0,
          boxShadow: ART_SHADOW,
          zIndex: 1,
          ...(animate ? { animation: 'csRevealPop 0.5s ease-out forwards' } : {}),
        }}
      >
        {children}
      </div>
    </div>
  )
}

export default function RevealScreen() {
  const { code } = useParams()
  const navigate = useNavigate()
  const playerId = getOrCreatePlayerId()
  const { user } = useAuth()

  // 'loading' | 'reveal' | 'error'
  const [phase, setPhase] = useState('loading')
  const [error, setError] = useState(null)
  const [combinedUrl, setCombinedUrl] = useState(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [sessionData, setSessionData] = useState(null)
  const [shareMsg, setShareMsg] = useState('')
  const [saveResult, setSaveResult] = useState(null)
  const [wantsAgain, setWantsAgain] = useState(false)
  const [soloStarting, setSoloStarting] = useState(false)
  const [soloStartError, setSoloStartError] = useState('')

  const [showReplay, setShowReplay] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const autoReplayRef = useRef(false)
  const pendingConfettiRef = useRef(false)

  const autosaveRef = useRef(false)
  const revealViewedFired = useRef(false)
  // Stable completedAt across retries: once set from doneAt or Date.now(), never changes for this session.
  const completedAtRef = useRef(null)
  const buildInitiatedRef = useRef(false)
  const resetInitiatedRef = useRef(false)
  const sessionRef = useRef(null)
  const missingRetryCountRef = useRef(0)
  const retryTimerRef = useRef(null)
  const handleRetryRef = useRef(null)

  const isSolo = sessionData?.settings?.mode === 'solo'

  const partnersWantingAgain = Object.entries(sessionData?.players || {})
    .filter(([pid, p]) => pid !== playerId && !p.left && p.wantsAgain)
    .map(([, p]) => p.name)

  const colorPage = (() => {
    const pageId = sessionStorage.getItem(`colorsplit_page_${code}`)
    if (pageId) {
      if (pageId === 'upload') {
        const uploadDataUrl = sessionStorage.getItem(`colorsplit_upload_${code}`)
        return uploadDataUrl ? { id: 'upload', name: 'Custom', svgContent: null, uploadDataUrl } : null
      }
      return getPageById(pageId) || null
    }
    const fbPageId = sessionData?.coloringPage?.id
    if (fbPageId && fbPageId !== 'upload') return getPageById(fbPageId) || null
    const saved = loadGallery().find(a => a.code === code && a.pageId && a.pageId !== 'upload')
    return saved?.pageId ? (getPageById(saved.pageId) || null) : null
  })()

  // ── Session subscription ──────────────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeToSession(code, (data) => {
      if (!data) return
      setSessionData(data)

      if (data.status === 'picking') {
        navigate(`/session/${code}/pick`, { replace: true })
        return
      }

      const isMultiplayer = data.settings?.mode !== 'solo'
      if (isMultiplayer && !resetInitiatedRef.current) {
        const active = Object.entries(data.players || {}).filter(([, p]) => p.name && !p.left)
        const allWant = active.length > 0 && active.every(([, p]) => p.wantsAgain)
        const hostActive = data.players?.[data.hostId] && !data.players[data.hostId].left
        const coordinatorId = hostActive ? data.hostId : active.map(([pid]) => pid).sort()[0]
        if (allWant && coordinatorId === playerId) {
          resetInitiatedRef.current = true
          const keys = [
            `colorsplit_page_${code}`,
            `colorsplit_canvas_${code}_left`,
            `colorsplit_canvas_${code}_right`,
            `colorsplit_canvas_${code}_latest`,
            `colorsplit_palette_${code}`,
          ]
          keys.forEach(k => sessionStorage.removeItem(k))
          resetRound(code, data.players).catch(() => navigate(`/session/${code}/pick`))
          return
        }
      }

      if (buildInitiatedRef.current) return
      buildInitiatedRef.current = true
      sessionRef.current = data

      const mode = data.settings?.mode || 'solo'

      if (mode === 'solo') {
        const snapshot = sessionStorage.getItem(`colorsplit_canvas_${code}_latest`)
        if (snapshot) {
          setCombinedUrl(snapshot)
          pendingConfettiRef.current = true
          setPhase('reveal')
          return
        }
        // Fallback: solo snapshot uploaded to Firebase Storage at Done time
        const firebaseUrl = data.players?.[playerId]?.canvasSnapshotUrl
        if (firebaseUrl) {
          const resolvedColorPage = colorPage
            ?? (data?.coloringPage?.id && data.coloringPage.id !== 'upload'
              ? getPageById(data.coloringPage.id)
              : null)
          buildColorTogetherImage([{ canvasSnapshotUrl: firebaseUrl }], resolvedColorPage)
            .then(url => {
              setCombinedUrl(url)
              pendingConfettiRef.current = true
              setPhase('reveal')
            })
            .catch(() => {
              setError('Artwork snapshot not found. Go back and finish your coloring session.')
              setPhase('error')
            })
          return
        }
        setError('Artwork snapshot not found. Go back and finish your coloring session.')
        setPhase('error')
        return
      }

      // Color Together: composite all player PNG snapshots
      const players = Object.entries(data.players || {})
        .filter(([, p]) => p.name && !p.left && p.assignedSection)

      if (players.length === 0) {
        setError('No active players found for this session.')
        setPhase('error')
        return
      }

      // Patch local player's missing canvasSnapshotUrl from the transparent sessionStorage fallback.
      // Do NOT use colorsplit_canvas_${code}_latest — that snapshot is white-filled with line art.
      const transparentFallback = sessionStorage.getItem(`colorsplit_transparent_snapshot_${code}_${playerId}`)
      const patchedPlayers = players.map(([pid, p]) =>
        pid === playerId && !p.canvasSnapshotUrl && transparentFallback
          ? [pid, { ...p, canvasSnapshotUrl: transparentFallback }]
          : [pid, p]
      )

      const missing = patchedPlayers.filter(([, p]) => !p.canvasSnapshotUrl)
      if (missing.length > 0) {
        buildInitiatedRef.current = false
        if (missingRetryCountRef.current < 3) {
          missingRetryCountRef.current += 1
          clearTimeout(retryTimerRef.current)
          retryTimerRef.current = setTimeout(() => handleRetryRef.current?.(), 3000)
        } else {
          setError('Reveal image is still preparing. Tap Retry when ready.')
          setPhase('error')
        }
        return
      }
      missingRetryCountRef.current = 0

      const resolvedColorPage = colorPage
        ?? (data?.coloringPage?.id && data.coloringPage.id !== 'upload'
          ? getPageById(data.coloringPage.id)
          : null)

      buildColorTogetherImage(patchedPlayers.map(([, p]) => p), resolvedColorPage)
        .then(url => {
          setCombinedUrl(url)
          pendingConfettiRef.current = true
          setPhase('reveal')
        })
        .catch(err => {
          setError(`Image loading failed: ${err.message}. Tap Retry.`)
          setPhase('error')
          buildInitiatedRef.current = false
        })
    })
    return () => { unsub(); clearTimeout(retryTimerRef.current) }
  }, [code])

  // ── Auto-dismiss confetti after 4.2s ──────────────────────────────────────
  useEffect(() => {
    if (!showConfetti) return
    const t = setTimeout(() => setShowConfetti(false), 4200)
    return () => clearTimeout(t)
  }, [showConfetti])

  // ── Auto-save once when artwork is ready ──────────────────────────────────
  useEffect(() => {
    if (phase !== 'reveal' || !combinedUrl || !sessionData || autosaveRef.current) return
    autosaveRef.current = true
    doSaveArtwork()
  }, [phase, combinedUrl, sessionData])

  useEffect(() => {
    if (phase !== 'reveal' || revealViewedFired.current) return
    revealViewedFired.current = true
    logBetaEvent('reveal_viewed')
  }, [phase])

  // ── Auto-open replay once per session when artwork is ready ───────────────
  useEffect(() => {
    if (phase !== 'reveal' || !combinedUrl || !sessionData || autoReplayRef.current) return
    let seenBefore = false
    try { seenBefore = !!sessionStorage.getItem(`colorsplit_replay_seen_${code}`) } catch {}
    if (seenBefore) {
      // Replay already seen (refresh / back-nav) — fire confetti immediately.
      if (pendingConfettiRef.current) {
        pendingConfettiRef.current = false
        setShowConfetti(true)
      }
      return
    }
    try { sessionStorage.setItem(`colorsplit_replay_seen_${code}`, 'true') } catch {}
    autoReplayRef.current = true
    setShowReplay(true)
    // confetti fires in handleReplayClose when the modal closes
  }, [phase, combinedUrl, sessionData, code])

  // ── Close replay modal — fire deferred confetti on first (auto) close ─────
  function handleReplayClose() {
    setShowReplay(false)
    if (pendingConfettiRef.current) {
      pendingConfettiRef.current = false
      setShowConfetti(true)
    }
  }

  // ── Celebrate (re-fire confetti) ──────────────────────────────────────────
  function handleCelebrate() {
    setShowConfetti(true)
  }

  // ── Retry after error ─────────────────────────────────────────────────────
  function handleRetry() {
    clearTimeout(retryTimerRef.current)
    retryTimerRef.current = null
    setError(null)
    setPhase('loading')
    buildInitiatedRef.current = false
    const data = sessionRef.current
    if (!data) return
    const mode = data.settings?.mode || 'solo'

    if (mode === 'solo') {
      const snapshot = sessionStorage.getItem(`colorsplit_canvas_${code}_latest`)
      if (snapshot) {
        setCombinedUrl(snapshot)
        setShowConfetti(true)
        setPhase('reveal')
        buildInitiatedRef.current = true
        return
      }
      // Fallback: Firebase snapshot URL (mirrors initial load behavior).
      const firebaseUrl = data.players?.[playerId]?.canvasSnapshotUrl
      if (firebaseUrl) {
        const resolvedColorPage = colorPage
          ?? (data?.coloringPage?.id && data.coloringPage.id !== 'upload'
            ? getPageById(data.coloringPage.id)
            : null)
        buildColorTogetherImage([{ canvasSnapshotUrl: firebaseUrl }], resolvedColorPage)
          .then(url => {
            setCombinedUrl(url)
            setShowConfetti(true)
            setPhase('reveal')
            buildInitiatedRef.current = true
          })
          .catch(() => {
            setError('Artwork snapshot not found.')
            setPhase('error')
          })
        return
      }
      setError('Artwork snapshot not found.')
      setPhase('error')
      return
    }

    const players = Object.entries(data.players || {})
      .filter(([, p]) => p.name && !p.left && p.assignedSection)

    // Patch local player's missing snapshot from sessionStorage transparent fallback.
    const transparentFallback = sessionStorage.getItem(`colorsplit_transparent_snapshot_${code}_${playerId}`)
    const patchedPlayers = players.map(([pid, p]) =>
      pid === playerId && !p.canvasSnapshotUrl && transparentFallback
        ? [pid, { ...p, canvasSnapshotUrl: transparentFallback }]
        : [pid, p]
    )

    const missing = patchedPlayers.filter(([, p]) => !p.canvasSnapshotUrl)
    if (missing.length > 0) {
      setError('Reveal image is still preparing. Try again in a moment.')
      setPhase('error')
      return
    }

    buildInitiatedRef.current = true
    const resolvedColorPage = colorPage
      ?? (data?.coloringPage?.id && data.coloringPage.id !== 'upload'
        ? getPageById(data.coloringPage.id)
        : null)
    buildColorTogetherImage(patchedPlayers.map(([, p]) => p), resolvedColorPage)
      .then(url => {
        setCombinedUrl(url)
        setShowConfetti(true)
        setPhase('reveal')
      })
      .catch(err => {
        setError(`Image loading failed: ${err.message}. Tap Retry.`)
        setPhase('error')
        buildInitiatedRef.current = false
      })
  }
  handleRetryRef.current = handleRetry

  // ── Gallery save ──────────────────────────────────────────────────────────
  async function doSaveArtwork() {
    if (!combinedUrl || !sessionData || isSaving) return
    setIsSaving(true)
    const players = Object.entries(sessionData.players || {})
      .filter(([, p]) => p.name)
      .map(([id, p]) => ({ id, name: p.name, left: !!p.left }))
    const leftPlayerIds = players.filter(p => p.left).map(p => p.id)
    const pageId = sessionStorage.getItem(`colorsplit_page_${code}`)
      || sessionData?.coloringPage?.id
      || loadGallery().find(a => a.code === code)?.pageId
      || ''
    // Stable id across retries: capture completedAt once and reuse it.
    if (!completedAtRef.current) {
      completedAtRef.current = sessionData.players?.[playerId]?.doneAt || Date.now()
    }
    const completedAt = completedAtRef.current
    const { ok, entry } = saveArtwork({
      id: `${code}_${completedAt}`,
      code,
      name: colorPage?.name ? `My ${colorPage.name}` : 'My Artwork',
      completedAt,
      pageId,
      mode: sessionData.settings?.mode || 'solo',
      players,
      savedByPlayerId: playerId,
      status: leftPlayerIds.length > 0 ? 'completed_after_leave' : 'completed',
      leftPlayerIds,
      finalImageUrl: await compressImageDataUrl(combinedUrl),
      strokes: [],
      allStrokes: null,
      tearLine: null,
      localOwnerType: user ? 'user' : 'guest',
      localOwnerId: user ? user.uid : playerId,
    })
    if (user && entry) {
      saveArtworkToCloud(user.uid, entry)
        .then(() => markArtworkMigrated(entry.id, user.uid, entry.id))
        .catch(e => console.warn('Cloud gallery save failed:', e?.message))
    }
    setIsSaving(false)
    if (ok) {
      logBetaEvent('gallery_saved')
      setSaveResult('saved')
      setTimeout(() => setSaveResult(null), 3200)
    } else {
      setSaveResult('failed')
      // 'failed' is intentionally not auto-cleared — user must tap Save again.
    }
  }

  // ── Download ──────────────────────────────────────────────────────────────
  function handleDownload() {
    if (!combinedUrl) return
    const link = document.createElement('a')
    link.download = `colorsplit-artwork-${code}.png`
    link.href = combinedUrl
    link.click()
  }

  // ── Share ─────────────────────────────────────────────────────────────────
  async function handleShare() {
    if (!combinedUrl) return
    const canShareFiles = navigator.canShare?.({
      files: [new File([], 'test.png', { type: 'image/png' })],
    })
    if (canShareFiles) {
      try {
        const res = await fetch(combinedUrl)
        const blob = await res.blob()
        const file = new File([blob], `colorsplit-${code}.png`, { type: 'image/png' })
        await navigator.share({ title: 'My ColorSplit artwork!', files: [file] })
        setShareMsg('Shared!')
        setTimeout(() => setShareMsg(''), 2500)
        return
      } catch (e) {
        if (e?.name === 'AbortError') return
      }
    }
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ColorSplit',
          text: 'Check out my ColorSplit artwork!',
          url: window.location.origin,
        })
        setShareMsg('Shared!')
        setTimeout(() => setShareMsg(''), 2500)
        return
      } catch (e) {
        if (e?.name === 'AbortError') return
      }
    }
    handleDownload()
    setShareMsg('Downloaded!')
    setTimeout(() => setShareMsg(''), 2500)
  }

  // ── Play Again ────────────────────────────────────────────────────────────
  async function handleAgain() {
    logBetaEvent('play_again')
    if (isSolo) {
      const keys = [
        `colorsplit_page_${code}`,
        `colorsplit_canvas_${code}_left`,
        `colorsplit_canvas_${code}_right`,
        `colorsplit_canvas_${code}_latest`,
        `colorsplit_palette_${code}`,
      ]
      keys.forEach(k => sessionStorage.removeItem(k))
      try {
        await resetRound(code, sessionData?.players || {})
      } catch {
        navigate(`/session/${code}/pick`)
      }
    } else {
      setWantsAgain(true)
      try {
        await setPlayerWantsAgain(code, playerId, true)
      } catch {
        setWantsAgain(false)
      }
    }
  }

  async function handleCancelAgain() {
    setWantsAgain(false)
    try { await setPlayerWantsAgain(code, playerId, false) } catch {}
  }

  async function handleLeaveRoom() {
    try { await leaveRoom(code, playerId) } catch {}
    navigate('/', { replace: true })
  }

  async function handleStartSolo() {
    if (soloStarting) return
    setSoloStarting(true)
    setSoloStartError('')
    if (!navigator.onLine) {
      setSoloStartError("You're offline — check your connection and try again.")
      setSoloStarting(false)
      return
    }
    try { await leaveRoom(code, playerId) } catch {}
    try {
      const playerName = getOrCreatePlayerName()
      const p = getProfile()
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Taking too long — check your connection and try again.')), 9000)
      )
      const newCode = await Promise.race([
        createSession(playerId, playerName, true, p?.avatarId ?? null, p?.colorId ?? null, user?.uid ?? null),
        timeout,
      ])
      navigate(`/session/${newCode}/pick`, { replace: true })
    } catch (e) {
      setSoloStartError(e.message || 'Could not start solo session — try again.')
      setSoloStarting(false)
    }
  }

  const everyoneElseLeft = !isSolo && Object.entries(sessionData?.players || {})
    .filter(([pid, p]) => pid !== playerId && p.name && !p.left).length === 0

  // ── Loading ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="bg-gradient-to-b from-[#FFFDF8] to-[#EDE8FF] min-h-screen flex flex-col items-center justify-center gap-4">
        <style>{KEYFRAMES}</style>
        <div className="text-5xl animate-bounce" style={{ animationDuration: '0.9s' }}>🎨</div>
        <p className="text-gray-400 font-body text-sm">Building your artwork…</p>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="bg-gradient-to-b from-[#FFFDF8] to-[#EDE8FF] min-h-screen flex flex-col items-center justify-center gap-5 px-6">
        <div className="text-4xl">😕</div>
        <p className="text-gray-600 font-body text-sm text-center max-w-xs">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={handleRetry}
            className="bg-violet-600 text-white font-semibold py-3 px-6 rounded-2xl font-body text-sm active:scale-95 transition-transform"
          >
            Retry
          </button>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="bg-white text-gray-600 font-semibold py-3 px-6 rounded-2xl font-body text-sm active:scale-95 transition-transform border border-gray-200"
          >
            Home
          </button>
        </div>
      </div>
    )
  }

  // ── Reveal ────────────────────────────────────────────────────────────────
  // Confetti fires simultaneously with the artwork reveal.
  return (
    <div className="bg-gradient-to-b from-[#FFFDF8] via-[#FDF8F2] to-[#EDE8FF] flex flex-col items-center h-screen overflow-y-auto justify-start">
      <style>{KEYFRAMES}</style>
      {showConfetti && <Confetti />}

      <div
        className="flex flex-col items-center w-full px-5 max-w-lg gap-3"
        style={{
          paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
          paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
        }}
      >
        {/* Header */}
        <div className="text-center">
          <div className="text-4xl mb-2">🎉</div>
          <h1
            className="font-display text-3xl text-gray-900 leading-tight"
            style={{ fontFamily: "'Fredoka One', cursive" }}
          >
            Masterpiece!
          </h1>
          {saveResult !== 'failed' && (
            <p className="font-body text-xs font-semibold text-green-600 mt-1">
              ✓ Saved to your gallery
            </p>
          )}
        </div>

        {/* Save failure with retry */}
        {saveResult === 'failed' && (
          <div className="flex flex-col items-center gap-2">
            <p className="font-body text-xs font-semibold text-red-500">
              ⚠️ Couldn't save — device storage may be full
            </p>
            <button
              onClick={doSaveArtwork}
              disabled={isSaving}
              className="bg-red-50 border border-red-200 text-red-600 font-semibold py-2 px-5 rounded-2xl font-body text-xs active:scale-95 transition-transform disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save again'}
            </button>
          </div>
        )}

        {/* Final artwork */}
        <ArtFrame animate>
          {combinedUrl ? (
            <img src={combinedUrl} alt="Masterpiece" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-50">
              <div className="text-4xl animate-pulse">🎨</div>
            </div>
          )}
        </ArtFrame>

        {/* Action buttons */}
        <div className="w-full grid grid-cols-4 gap-2">
          {[
            { icon: '🎉', label: 'Celebrate',    onClick: handleCelebrate,             disabled: false        },
            { icon: '⬇️', label: 'Download',     onClick: handleDownload,              disabled: !combinedUrl },
            { icon: shareMsg ? '✓' : '🔗', label: shareMsg || 'Share', onClick: handleShare, disabled: !combinedUrl },
            { icon: '🖼️', label: 'View Gallery', onClick: () => navigate('/gallery'),  disabled: false        },
          ].map(({ icon, label, onClick, disabled }) => (
            <button
              key={label}
              onClick={onClick}
              disabled={disabled}
              className="flex flex-col items-center gap-1.5 bg-white border border-gray-100 rounded-2xl py-2.5 px-1 active:scale-95 transition-transform shadow-sm disabled:opacity-40"
            >
              <span className="text-xl">{icon}</span>
              <span className="text-gray-800 font-body text-[10px] font-semibold leading-tight text-center">{label}</span>
            </button>
          ))}
        </div>

        {/* Replay — optional extra, below core actions */}
        <button
          onClick={() => setShowReplay(true)}
          className="w-full bg-white border border-gray-100 rounded-2xl py-3 px-4 flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-sm"
        >
          <span className="text-base">⏩</span>
          <span className="text-gray-700 font-body text-sm font-semibold">Watch Replay</span>
        </button>

        {/* Partners-wanting-again nudge */}
        {!isSolo && !wantsAgain && partnersWantingAgain.length > 0 && (
          <div className="w-full bg-violet-50 border border-violet-200 rounded-2xl px-4 py-2.5 text-center">
            <p className="text-violet-600 font-body text-xs">
              🎮 {partnersWantingAgain.join(' & ')} wants to play again
            </p>
          </div>
        )}

        {/* Contextual navigation */}
        {wantsAgain ? (
          <div className="w-full bg-white border border-gray-100 rounded-3xl px-5 py-5 flex flex-col gap-4 shadow-sm">
            <div className="text-center">
              <div className="text-2xl mb-1.5">⏳</div>
              <p className="text-gray-700 font-body text-sm font-semibold">
                Waiting for your coloring buddy…
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-2.5">
                <span className="text-gray-500 font-body text-sm">You</span>
                <span className="text-green-600 font-body text-sm font-semibold">Ready ✓</span>
              </div>
              {Object.entries(sessionData?.players || {})
                .filter(([pid, p]) => pid !== playerId && !p.left)
                .map(([pid, p]) => (
                  <div key={pid} className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-2.5">
                    <span className="text-gray-500 font-body text-sm">{p.name}</span>
                    {p.wantsAgain
                      ? <span className="text-green-600 font-body text-sm font-semibold">Ready ✓</span>
                      : <span className="text-gray-400 font-body text-sm">Waiting…</span>
                    }
                  </div>
                ))
              }
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCancelAgain}
                className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-2xl font-body text-sm active:scale-95 transition-transform border border-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleLeaveRoom}
                className="flex-1 bg-transparent text-red-400 font-semibold py-3 rounded-2xl font-body text-sm active:scale-95 transition-transform border border-red-200"
              >
                Leave Room
              </button>
            </div>
          </div>

        ) : everyoneElseLeft ? (
          <div className="w-full flex flex-col gap-3">
            <button
              onClick={handleStartSolo}
              disabled={soloStarting}
              className="w-full text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform font-body disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #8B6EF8 0%, #7C5CFF 100%)' }}
            >
              {soloStarting ? '…Starting solo…' : '🎨 Start Solo Coloring'}
            </button>
            {soloStartError && (
              <p className="text-red-500 font-body text-xs text-center -mt-1">{soloStartError}</p>
            )}
            <button
              onClick={handleLeaveRoom}
              className="w-full bg-white text-gray-600 font-semibold py-3.5 rounded-2xl font-body text-sm active:scale-95 transition-transform border border-gray-200 shadow-sm"
            >
              🏠 Back Home
            </button>
          </div>

        ) : (
          <div className="w-full flex flex-col gap-3">
            <button
              onClick={isSolo ? () => navigate('/', { replace: true }) : handleLeaveRoom}
              className={`w-full bg-white font-semibold py-3.5 rounded-2xl font-body text-sm active:scale-95 transition-transform border shadow-sm ${
                isSolo ? 'text-gray-600 border-gray-200' : 'text-red-400 border-red-200'
              }`}
            >
              {isSolo ? '🏠 Home' : '🚪 Leave Room'}
            </button>
            <button
              onClick={handleAgain}
              className="w-full text-white font-bold py-4 rounded-2xl active:scale-95 transition-transform font-body"
              style={{ background: 'linear-gradient(135deg, #8B6EF8 0%, #7C5CFF 100%)' }}
            >
              🔄 Play Again
            </button>
          </div>
        )}
      </div>

      {showReplay && (
        <ReplayModal
          code={code}
          sessionData={sessionData}
          playerId={playerId}
          colorPage={colorPage}
          onClose={handleReplayClose}
        />
      )}
    </div>
  )
}
