import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { getPageById } from '../lib/coloringPages'
import { subscribeToSession, getOrCreatePlayerId, getAllStrokes, resetRound, setPlayerWantsAgain, leaveRoom } from '../lib/session'
import { buildAllowedMask, buildRevealMask, smoothPoints, drawStroke } from '../lib/canvasUtils'
import { saveArtwork, compressImageDataUrl, markArtworkMigrated } from '../lib/gallery'
import { saveArtworkToCloud } from '../lib/cloudGallery'
import useAuth from '../hooks/useAuth'
import AuthModal from '../components/AuthModal'
import { generateRevealVideo, shareOrDownloadVideo, shareOrDownloadImage, isRevealVideoSupported } from '../lib/revealVideo'
import { copyText } from '../lib/share'
import TimeLapsePlayer from '../components/TimeLapsePlayer'
import MaskedTearReplay from '../components/MaskedTearReplay'

const CANVAS_SIZE = 800

function flattenStrokes(allStrokes) {
  const flat = []
  for (const playerStrokes of Object.values(allStrokes || {})) {
    for (const stroke of Object.values(playerStrokes || {})) {
      if (stroke?.points?.length) flat.push(stroke)
    }
  }
  return flat.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
}


/**
 * Render a masked tear-mode reveal image.
 * Each player's strokes are drawn on a separate canvas, clipped to their
 * assigned section via destination-in, then composited onto one final canvas.
 * The full coloring-page contour is drawn on top.
 * Returns a data URL (PNG) or null on failure.
 */
async function renderTearReveal(allStrokes, sessionData, colorPage) {
  const tearPoints = sessionData?.tearLine?.points
  const orientation = sessionData?.tearLine?.orientation ?? 'horizontal'
  if (!tearPoints?.length) return null

  // Final canvas — white background
  const final = document.createElement('canvas')
  final.width = CANVAS_SIZE
  final.height = CANVAS_SIZE
  const finalCtx = final.getContext('2d')
  finalCtx.fillStyle = '#ffffff'
  finalCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  // Render each player's piece separately, then mask + composite
  const players = Object.entries(sessionData.players || {})
  for (const [pid, playerData] of players) {
    const section = playerData.assignedSection
    if (!section) continue

    const playerStrokes = Object.values(allStrokes?.[pid] || {})
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    if (playerStrokes.length === 0) continue

    // Draw this player's strokes on their own offscreen canvas
    const piece = document.createElement('canvas')
    piece.width = CANVAS_SIZE
    piece.height = CANVAS_SIZE
    const pieceCtx = piece.getContext('2d')

    for (const stroke of playerStrokes) {
      drawStroke(pieceCtx, stroke)
    }

    const mask = buildRevealMask(tearPoints, section, orientation)
    pieceCtx.save()
    pieceCtx.globalCompositeOperation = 'destination-in'
    pieceCtx.drawImage(mask, 0, 0)
    pieceCtx.restore()

    // Composite this masked piece onto the final canvas
    finalCtx.drawImage(piece, 0, 0)
  }

  // Draw the full coloring-page contour on top (multiply keeps lines visible)
  await new Promise(resolve => {
    if (!colorPage) { resolve(); return }
    const img = new Image()
    img.onload = () => {
      finalCtx.save()
      finalCtx.globalCompositeOperation = 'multiply'
      finalCtx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
      finalCtx.restore()
      resolve()
    }
    img.onerror = () => resolve()
    if (colorPage.svgContent) {
      const blob = new Blob([colorPage.svgContent], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      img.onload = () => {
        finalCtx.save()
        finalCtx.globalCompositeOperation = 'multiply'
        finalCtx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
        finalCtx.restore()
        URL.revokeObjectURL(url)
        resolve()
      }
      img.src = url
    } else if (colorPage.uploadDataUrl || colorPage.imageUrl) {
      img.src = colorPage.uploadDataUrl || colorPage.imageUrl
    } else {
      resolve()
    }
  })

  return final.toDataURL('image/png')
}
// ─────────────────────────────────────────────────────────────────────────────

export default function RevealScreen() {
  const { code } = useParams()
  const navigate = useNavigate()
  const playerId = getOrCreatePlayerId()

  const [phase, setPhase] = useState('loading') // loading | timelapse | slide | reveal
  const [strokes, setStrokes] = useState([])
  const [capturedUrl, setCapturedUrl] = useState(null)
  const [isTearMode, setIsTearMode] = useState(false)
  const [sessionData, setSessionData] = useState(null)
  const [shareMsg, setShareMsg] = useState('')
  const [gallerySaved, setGallerySaved] = useState(false)
  const [artworkName, setArtworkName] = useState('')
  const [showNameModal, setShowNameModal] = useState(false)
  const [replayKey, setReplayKey] = useState(0)
  const [tearReplayKey, setTearReplayKey] = useState(0)
  const [allStrokesData, setAllStrokesData] = useState(null)
  const [wantsAgain, setWantsAgain] = useState(false)
  const [leftPlayerNames, setLeftPlayerNames] = useState([])
  const [saveResult, setSaveResult] = useState(null) // null | 'saved' | 'failed'
  const [videoState, setVideoState] = useState('idle') // idle | rendering | shared | downloaded | error
  const [videoProgress, setVideoProgress] = useState(0)
  const { user } = useAuth()
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)

  const isSolo = sessionData?.settings?.mode === 'solo'

  // Names of other active players who have already flagged wantsAgain
  const partnersWantingAgain = Object.entries(sessionData?.players || {})
    .filter(([pid, p]) => pid !== playerId && !p.left && p.wantsAgain)
    .map(([, p]) => p.name)

  const sessionRef = useRef(null)
  const resetInitiatedRef = useRef(false)

  const colorPage = useMemo(() => {
    const pageId = sessionStorage.getItem(`colorsplit_page_${code}`)
    if (!pageId) return null
    if (pageId === 'upload') {
      const uploadDataUrl = sessionStorage.getItem(`colorsplit_upload_${code}`)
      return uploadDataUrl ? { id: 'upload', name: 'Custom', svgContent: null, uploadDataUrl } : null
    }
    return getPageById(pageId) || null
  }, [code])

  const displaySize = typeof window !== 'undefined'
    ? Math.min(window.innerWidth - 48, window.innerHeight - 200, 420)
    : 340

  useEffect(() => {
    const unsub = subscribeToSession(code, async (data) => {
      if (!data) return
      setSessionData(data)

      // Players who left: informational only — the reveal still includes
      // their strokes and the remaining player keeps full save/share access.
      setLeftPlayerNames(
        Object.entries(data.players || {})
          .filter(([pid, p]) => pid !== playerId && p.left)
          .map(([, p]) => p.name || 'A player')
      )

      if (data.status === 'picking') {
        navigate(`/session/${code}/pick`, { replace: true })
        return
      }

      // Multiplayer: when all active players have flagged wantsAgain, exactly
      // one client resets the round. Normally the host — but if the host left,
      // the first active player (sorted id) takes over so the room can't get
      // stuck waiting on someone who's gone.
      const isMultiplayer = data.settings?.mode !== 'solo'
      if (isMultiplayer && !resetInitiatedRef.current) {
        const activePlayers = Object.entries(data.players || {}).filter(([, p]) => p.name && !p.left)
        const allWantAgain = activePlayers.length > 0 && activePlayers.every(([, p]) => p.wantsAgain)
        const hostActive = data.players?.[data.hostId] && !data.players[data.hostId].left
        const coordinatorId = hostActive ? data.hostId : activePlayers.map(([pid]) => pid).sort()[0]
        if (allWantAgain && coordinatorId === playerId) {
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

      if (!sessionRef.current) {
        sessionRef.current = data
        const isTear = data.settings?.mode === 'tear'
        setIsTearMode(isTear)
        try {
          const all = await getAllStrokes(code)
          if (isTear) {
            setAllStrokesData(all)
            // Pre-render the final composite in the background.
            // It finishes long before MaskedTearReplay completes (canvas ops ~100ms).
            renderTearReveal(all, data, colorPage)
              .then(dataUrl => { if (dataUrl) setCapturedUrl(dataUrl) })
              .catch(() => {})
            // Show drawing evolution first — same as solo timelapse
            setPhase('masked-replay')
          } else {
            // Solo / together mode: keep existing timelapse behavior
            setStrokes(flattenStrokes(all))
            setPhase('timelapse')
          }
        } catch {
          // Fallback: skip to reveal if something fails
          setPhase(isTear ? 'reveal' : 'timelapse')
        }
      }
    })
    return unsub
  }, [code])

  useEffect(() => {
    if (phase !== 'reveal' || !capturedUrl || gallerySaved || !sessionData) return
    const defaultName = colorPage?.name ? `My ${colorPage.name}` : 'My Artwork'
    setArtworkName(defaultName)
    setShowNameModal(true)
  }, [phase, capturedUrl, gallerySaved, sessionData])


  function handleCapture(dataUrl) {
    setCapturedUrl(dataUrl)
  }

  function handleTimeLapseComplete() {
    if (isTearMode) {
      setPhase('slide')
      setTimeout(() => setPhase('reveal'), 4500)
    } else {
      setPhase('reveal')
    }
  }

  function handleReplay() {
    if (isTearMode) {
      // Tear mode: show masked stroke evolution, then slide into final reveal
      if (allStrokesData) {
        setTearReplayKey(k => k + 1)
        setPhase('masked-replay')
      } else {
        // allStrokes not in state (e.g. page refreshed at reveal) — fetch then replay
        const data = sessionRef.current
        if (data) {
          getAllStrokes(code)
            .then(all => {
              setAllStrokesData(all)
              setTearReplayKey(k => k + 1)
              setPhase('masked-replay')
            })
            .catch(() => {
              // Fallback: skip to slide/reveal if fetch fails
              setPhase('slide')
              setTimeout(() => setPhase('reveal'), 4500)
            })
        } else {
          setPhase('slide')
          setTimeout(() => setPhase('reveal'), 4500)
        }
      }
    } else {
      // Solo / together mode: existing timelapse replay
      setReplayKey(k => k + 1)
      setPhase('timelapse')
    }
  }

  async function handleAgain() {
    if (isSolo) {
      // Solo: reset immediately, same as before
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
        // navigation handled by subscription detecting status === 'picking'
      } catch {
        navigate(`/session/${code}/pick`)
      }
    } else {
      // Multiplayer: just flag this player as wanting another round.
      // The subscription detects when all active players agree, then the host resets.
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
    try {
      await setPlayerWantsAgain(code, playerId, false)
    } catch {}
  }

  async function handleLeaveRoom() {
    try { await leaveRoom(code, playerId) } catch {}
    navigate('/', { replace: true })
  }

  async function doSaveArtwork(name) {
    if (gallerySaved || !sessionData || !capturedUrl) return
    setGallerySaved(true)
    const isTear = sessionData.settings?.mode === 'tear'
    // Keep ALL players (including those who left) so contributor names survive.
    const players = Object.entries(sessionData.players || {})
      .filter(([, p]) => p.name)
      .map(([id, p]) => ({
        id,
        name: p.name,
        left: !!p.left,
        ...(isTear ? { assignedSection: p.assignedSection } : {}),
      }))
    const leftPlayerIds = players.filter(p => p.left).map(p => p.id)
    const pageId = sessionStorage.getItem(`colorsplit_page_${code}`) || ''
    const completedAt = Date.now()
    // Canonical artwork id: every player fetches the same stroke set, so the
    // earliest stroke timestamp identifies this round identically on every
    // device. The same account saving from two devices then hits the same
    // cloud key instead of creating a duplicate gallery card.
    const strokeTimestamps = (isTear
      ? Object.values(allStrokesData || {}).flatMap(m => Object.values(m || {}))
      : strokes
    ).map(s => s?.timestamp || 0).filter(Boolean)
    const roundTs = strokeTimestamps.length ? Math.min(...strokeTimestamps) : completedAt
    const { ok, entry } = saveArtwork({
      id: `${code}_${roundTs}`,
      code,
      name: name || 'My Artwork',
      completedAt,
      pageId,
      mode: sessionData.settings?.mode || 'solo',
      players,
      savedByPlayerId: playerId,
      status: leftPlayerIds.length > 0 ? 'completed_after_leave' : 'completed',
      leftPlayerIds,
      // JPEG re-encode: a full-res PNG data URL can exceed 1 MB and silently
      // blow the localStorage quota after a few artworks.
      finalImageUrl: await compressImageDataUrl(capturedUrl),
      strokes: isTear ? [] : strokes,
      allStrokes: isTear ? allStrokesData : null,
      tearLine: isTear ? sessionData.tearLine : null,
      localOwnerType: user ? 'user' : 'guest',
      localOwnerId: user ? user.uid : playerId,
    })
    // Signed-in users also get the artwork in their account gallery. Cloud
    // failure never blocks the local save feedback. On success the local copy
    // is stamped migrated so the migration prompt never re-offers it.
    if (user && entry) {
      saveArtworkToCloud(user.uid, entry)
        .then(() => markArtworkMigrated(entry.id, user.uid, entry.id))
        .catch(e => console.warn('Cloud gallery save failed:', e?.message))
    }
    setSaveResult(ok ? 'saved' : 'failed')
    // Guests get a longer toast with a "keep it forever" account prompt
    setTimeout(() => setSaveResult(null), ok && !user ? 6500 : 3200)
  }

  function handleSaveName() {
    doSaveArtwork(artworkName.trim() || 'My Artwork')
    setShowNameModal(false)
  }

  async function handleSave() {
    if (!capturedUrl) return
    const link = document.createElement('a')
    link.download = `colorsplit-artwork-${code}.png`
    link.href = capturedUrl
    link.click()
  }

  function flashShareMsg(msg) {
    setShareMsg(msg)
    setTimeout(() => setShareMsg(''), 2500)
  }

  // Masterpiece "Share" button. Prefer the native sheet with the actual artwork
  // image; otherwise copy a link via the robust share helper (execCommand
  // fallback) so it always gives feedback instead of silently failing.
  async function handleShare() {
    const url = window.location.origin
    // Check file-share capability synchronously (no await — preserves the user gesture token)
    const canShareFiles = capturedUrl && navigator.canShare?.({
      files: [new File([], 'test.png', { type: 'image/png' })]
    })
    // 1. Native share of the artwork image (mobile / PWA)
    if (canShareFiles) {
      try {
        const res = await fetch(capturedUrl)
        const blob = await res.blob()
        const file = new File([blob], `colorsplit-${code}.png`, { type: 'image/png' })
        await navigator.share({ title: 'My ColorSplit artwork! 🎨', files: [file] })
        flashShareMsg('Shared!')
        return
      } catch (e) {
        if (e?.name === 'AbortError') return // user dismissed the sheet
        // Non-AbortError: gesture token may be consumed — fall through to clipboard
      }
    }
    // 2. Native share of a link — only if we haven't burned the gesture token above
    if (!canShareFiles && navigator.share) {
      try {
        await navigator.share({ title: 'ColorSplit', text: 'Check out my ColorSplit artwork! 🎨', url })
        flashShareMsg('Shared!')
        return
      } catch (e) {
        if (e?.name === 'AbortError') return
      }
    }
    // 3. Clipboard fallback with guaranteed feedback
    const ok = await copyText(url)
    flashShareMsg(ok ? 'Link copied!' : 'Copy failed — long-press to copy')
  }

  // Fallback path: share/download the final still image with clear feedback.
  async function fallbackToImage() {
    if (!capturedUrl) { setVideoState('error'); setTimeout(() => setVideoState('idle'), 3500); return }
    try {
      const outcome = await shareOrDownloadImage(capturedUrl, code)
      setVideoState(outcome === 'shared' ? 'image-shared' : 'image-saved')
    } catch {
      setVideoState('error')
    }
    setTimeout(() => setVideoState('idle'), 3500)
  }

  async function handleShareVideo() {
    if (videoState === 'rendering' || !capturedUrl || !sessionData) return

    // No video support on this device → fall back to the still image up front.
    if (!isRevealVideoSupported()) {
      await fallbackToImage()
      return
    }

    setVideoState('rendering')
    setVideoProgress(0)
    try {
      // Tear mode needs allStrokes; fetch them if a refresh dropped the state.
      let all = allStrokesData
      if (isTearMode && !all) {
        all = await getAllStrokes(code)
        setAllStrokesData(all)
      }
      // The video is always one normal coloring page — tear strokes are merged
      // internally into a single timelapse (no split visuals).
      const result = await generateRevealVideo({
        allStrokes: all,
        strokes,
        colorPage,
        finalImageUrl: capturedUrl,
        onProgress: p => setVideoProgress(p),
      })
      const outcome = await shareOrDownloadVideo(result, code)
      setVideoState(outcome)
      setTimeout(() => setVideoState('idle'), 3000)
    } catch {
      // Video generation failed mid-way → fall back to the still image.
      await fallbackToImage()
    }
  }


  const tearPts = sessionData?.tearLine?.points || []
  const tearOrientation = sessionData?.tearLine?.orientation ?? 'horizontal'
  const tearScale = displaySize / 400
  const tearScaled = tearPts.map(p => ({ x: p.x * tearScale, y: p.y * tearScale }))
  const w = displaySize
  const h = displaySize

  // Clip paths and slide directions depend on orientation
  const [pieceAClip, pieceBClip, pieceAInit, pieceBInit, pieceAAnimate, pieceBAnimate] = (() => {
    const rev = [...tearScaled].reverse()
    if (tearOrientation === 'vertical') {
      const fwd = tearScaled.map(p => `L ${p.x} ${p.y}`).join(' ')
      const bwd = rev.map(p => `L ${p.x} ${p.y}`).join(' ')
      const a = tearScaled.length
        ? `path('M 0 0 ${fwd} L 0 ${h} Z')`
        : `path('M 0 0 L ${w / 2} 0 L ${w / 2} ${h} L 0 ${h} Z')`
      const b = tearScaled.length
        ? `path('M ${tearScaled[0].x} ${tearScaled[0].y} L ${w} 0 L ${w} ${h} ${bwd} Z')`
        : `path('M ${w / 2} 0 L ${w} 0 L ${w} ${h} L ${w / 2} ${h} Z')`
      return [a, b, { x: -w }, { x: w }, { x: 0 }, { x: 0 }]
    }
    // horizontal
    const fwd = tearScaled.map(p => `L ${p.x} ${p.y}`).join(' ')
    const bwd = rev.map(p => `L ${p.x} ${p.y}`).join(' ')
    const a = tearScaled.length
      ? `path('M 0 0 L ${w} 0 L ${tearScaled[tearScaled.length - 1].x} ${tearScaled[tearScaled.length - 1].y} ${bwd} L 0 ${tearScaled[0].y} Z')`
      : `path('M 0 0 L ${w} 0 L ${w} ${h / 2} L 0 ${h / 2} Z')`
    const b = tearScaled.length
      ? `path('M 0 ${tearScaled[0].y} ${fwd} L ${w} ${h} L 0 ${h} Z')`
      : `path('M 0 ${h / 2} L ${w} ${h / 2} L ${w} ${h} L 0 ${h} Z')`
    return [a, b, { y: -h }, { y: h }, { y: 0 }, { y: 0 }]
  })()

  const seamPolyline = tearScaled.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <div className={`bg-[#1a1a1a] flex flex-col items-center ${phase === 'reveal' ? 'h-screen overflow-y-auto justify-start' : 'min-h-screen justify-center overflow-hidden'}`}>

      {/* Loading */}
      {phase === 'loading' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
            className="text-4xl"
          >
            ⏳
          </motion.div>
          <p className="text-white/40 font-body text-sm">Loading your artwork…</p>
        </motion.div>
      )}

      {/* Timelapse */}
      {phase === 'timelapse' && (
        <motion.div
          key={`timelapse-${replayKey}`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-5 px-6 w-full"
        >
          <motion.h2
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="font-display text-3xl text-white text-center"
            style={{ fontFamily: "'Fredoka One', cursive" }}
          >
            ⏩ Replay
          </motion.h2>
          <TimeLapsePlayer
            key={replayKey}
            strokes={strokes}
            colorPage={colorPage}
            width={displaySize}
            onComplete={handleTimeLapseComplete}
            onCapture={handleCapture}
          />
          <p className="text-white/35 font-body text-sm">
            {sessionData?.settings?.mode === 'solo' ? 'Your session at 8× speed' : 'All strokes at 8× speed'}
          </p>
        </motion.div>
      )}

      {/* Masked replay (tear mode) */}
      {phase === 'masked-replay' && allStrokesData && sessionData && (
        <motion.div
          key={`tear-replay-${tearReplayKey}`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-5 px-6 w-full"
        >
          <motion.h2
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="font-display text-3xl text-white text-center"
            style={{ fontFamily: "'Fredoka One', cursive" }}
          >
            ⏩ Replay
          </motion.h2>
          <MaskedTearReplay
            key={tearReplayKey}
            allStrokes={allStrokesData}
            sessionData={sessionData}
            colorPage={colorPage}
            width={displaySize}
            onComplete={() => {
              setPhase('slide')
              setTimeout(() => setPhase('reveal'), 4500)
            }}
          />
          <p className="text-white/35 font-body text-sm">Coloring at 8× speed</p>
        </motion.div>
      )}

      {/* Slide animation (tear mode) */}
      {phase === 'slide' && capturedUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-5 px-6 w-full"
        >
          <motion.h2
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="font-display text-3xl text-white text-center"
            style={{ fontFamily: "'Fredoka One', cursive" }}
          >
            🧩 Putting it together…
          </motion.h2>
          <div
            className="relative rounded-3xl shadow-deep"
            style={{ width: w, height: h, overflow: 'hidden', background: '#111' }}
          >
            {/* Piece A — slides in from top (H) or left (V) */}
            <motion.div
              style={{ position: 'absolute', inset: 0, clipPath: pieceAClip }}
              initial={pieceAInit}
              animate={pieceAAnimate}
              transition={{ delay: 0.3, type: 'spring', stiffness: 65, damping: 16 }}
            >
              <img src={capturedUrl} alt="" style={{ width: w, height: h, display: 'block' }} />
            </motion.div>

            {/* Piece B — slides in from bottom (H) or right (V) */}
            <motion.div
              style={{ position: 'absolute', inset: 0, clipPath: pieceBClip }}
              initial={pieceBInit}
              animate={pieceBAnimate}
              transition={{ delay: 0.7, type: 'spring', stiffness: 65, damping: 16 }}
            >
              <img src={capturedUrl} alt="" style={{ width: w, height: h, display: 'block' }} />
            </motion.div>

            {/* Seam glow along actual tear line */}
            {seamPolyline && (
              <motion.svg
                width={w} height={h}
                style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 10 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0, 1, 1, 0] }}
                transition={{ delay: 2.4, duration: 1.4, times: [0, 0.1, 0.35, 0.7, 1] }}
              >
                <polyline points={seamPolyline} fill="none" stroke="white" strokeWidth="3" strokeOpacity="0.95" />
                <polyline points={seamPolyline} fill="none" stroke="white" strokeWidth="10" strokeOpacity="0.25" />
              </motion.svg>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Reveal — redesigned Masterpiece screen ───────────────────────────── */}
      {phase === 'reveal' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center w-full px-5 max-w-lg gap-5"
          style={{
            paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
            paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
          }}
        >

          {/* ── 1. Header ────────────────────────────────────────────────────── */}
          <motion.div
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="text-center"
          >
            <div className="text-4xl mb-2">🎉</div>
            <h1
              className="font-display text-3xl text-white leading-tight"
              style={{ fontFamily: "'Fredoka One', cursive" }}
            >
              Masterpiece!
            </h1>
            <p className="text-white/40 font-body text-sm mt-1">
              {isSolo ? 'You created this.' : 'You created this together.'}
            </p>
            {leftPlayerNames.length > 0 && (
              <p className="text-orange-300/80 font-body text-xs mt-2 bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-1.5 inline-block">
                👋 {leftPlayerNames.join(' & ')} left earlier — their coloring is still part of the artwork.
              </p>
            )}
          </motion.div>

          {/* ── 2. Artwork hero ──────────────────────────────────────────────── */}
          <motion.div
            className="w-full max-w-[260px] rounded-3xl overflow-hidden bg-white"
            style={{ aspectRatio: '1', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 22, delay: 0.1 }}
          >
            {capturedUrl ? (
              <img src={capturedUrl} alt="Masterpiece" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-50 text-5xl">🎨</div>
            )}
          </motion.div>

          {/* ── 3. Secondary actions ─────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="w-full grid grid-cols-3 gap-2.5"
          >
            {/* Replay */}
            <button
              onClick={handleReplay}
              className="flex flex-col items-center gap-1.5 bg-white/8 border border-white/6 rounded-2xl py-3.5 px-2 active:scale-95 transition-transform"
            >
              <span className="text-xl">🔁</span>
              <span className="text-white font-body text-xs font-semibold">Replay</span>
              <span className="text-white/30 font-body text-[10px] text-center leading-tight">Watch it again</span>
            </button>

            {/* Save as PNG */}
            <button
              onClick={handleSave}
              disabled={!capturedUrl}
              className="flex flex-col items-center gap-1.5 bg-white/8 border border-white/6 rounded-2xl py-3.5 px-2 active:scale-95 transition-all disabled:opacity-40"
            >
              <span className="text-xl">💾</span>
              <span className="text-white font-body text-xs font-semibold">Save</span>
              <span className="text-white/30 font-body text-[10px] text-center leading-tight">Save to device</span>
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="flex flex-col items-center gap-1.5 bg-white/8 border border-white/6 rounded-2xl py-3.5 px-2 active:scale-95 transition-transform"
            >
              <span className="text-xl">{shareMsg ? (shareMsg.includes('failed') ? '⚠️' : '✓') : '🔗'}</span>
              <span className="text-white font-body text-xs font-semibold">{shareMsg || 'Share'}</span>
              <span className="text-white/30 font-body text-[10px] text-center leading-tight">
                {shareMsg ? '' : 'Share with friends'}
              </span>
            </button>
          </motion.div>

          {/* ── 3b. Shareable reveal video ───────────────────────────────────── */}
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={handleShareVideo}
            disabled={!capturedUrl || videoState === 'rendering'}
            className="w-full bg-white/8 border border-white/10 rounded-2xl py-3.5 px-4 active:scale-[0.98] transition-transform disabled:opacity-60 relative overflow-hidden"
          >
            {videoState === 'rendering' && (
              <div
                className="absolute inset-y-0 left-0 bg-blue-500/25 transition-all"
                style={{ width: `${Math.round(videoProgress * 100)}%` }}
              />
            )}
            <span className="relative flex items-center justify-center gap-2 text-white font-body text-sm font-semibold text-center">
              {videoState === 'rendering' && <>🎬 Creating your reveal video… {Math.round(videoProgress * 100)}%</>}
              {videoState === 'shared' && <>✓ Shared!</>}
              {videoState === 'downloaded' && <>✓ Video saved!</>}
              {videoState === 'image-shared' && <>✓ Shared image (video not supported here)</>}
              {videoState === 'image-saved' && <>✓ Image saved (video not supported here)</>}
              {videoState === 'error' && <>😕 Couldn’t create the video — try again</>}
              {videoState === 'idle' && <>🎬 Share reveal video</>}
            </span>
          </motion.button>

          {/* ── 4. Decision area ─────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="w-full"
          >
            {/* Partner nudge — subtle banner when partner already clicked Again */}
            <AnimatePresence>
              {!isSolo && !wantsAgain && partnersWantingAgain.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="w-full bg-blue-500/10 border border-blue-500/20 rounded-2xl px-4 py-2.5 text-center mb-3 overflow-hidden"
                >
                  <p className="text-blue-300 font-body text-xs">
                    🎮 {partnersWantingAgain.join(' & ')} wants to play again
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Waiting state ─────────────────────────────────────────────── */}
            <AnimatePresence mode="wait">
              {wantsAgain ? (
                <motion.div
                  key="waiting"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                  className="w-full bg-white/6 border border-white/10 rounded-3xl px-5 py-5 flex flex-col gap-4"
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1.5">⏳</div>
                    <p className="text-white/70 font-body text-sm font-semibold">
                      Waiting for your coloring buddy…
                    </p>
                  </div>

                  {/* Per-player status rows */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between bg-white/5 rounded-2xl px-4 py-2.5">
                      <span className="text-white/50 font-body text-sm">You</span>
                      <span className="text-green-400 font-body text-sm font-semibold">Ready ✓</span>
                    </div>
                    {Object.entries(sessionData?.players || {})
                      .filter(([pid, p]) => pid !== playerId && !p.left)
                      .map(([pid, p]) => (
                        <div key={pid} className="flex items-center justify-between bg-white/5 rounded-2xl px-4 py-2.5">
                          <span className="text-white/50 font-body text-sm">{p.name}</span>
                          {p.wantsAgain
                            ? <span className="text-green-400 font-body text-sm font-semibold">Ready ✓</span>
                            : <motion.span
                                animate={{ opacity: [0.4, 1, 0.4] }}
                                transition={{ repeat: Infinity, duration: 1.6 }}
                                className="text-white/30 font-body text-sm"
                              >Waiting…</motion.span>
                          }
                        </div>
                      ))
                    }
                  </div>

                  {/* Cancel + Leave Room */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleCancelAgain}
                      className="flex-1 bg-white/8 text-white/60 font-semibold py-3 rounded-2xl font-body text-sm active:scale-95 transition-transform border border-white/8"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleLeaveRoom}
                      className="flex-1 bg-red-500/10 text-red-400 font-semibold py-3 rounded-2xl font-body text-sm active:scale-95 transition-transform border border-red-500/20"
                    >
                      Leave Room
                    </button>
                  </div>
                </motion.div>

              ) : (!isSolo && Object.entries(sessionData?.players || {})
                    .filter(([pid, p]) => pid !== playerId && p.name && !p.left).length === 0) ? (
                /* ── Everyone else left: no partner to "play again" with ────── */
                <motion.div key="alone" className="flex gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <button
                    onClick={() => navigate('/gallery')}
                    className="flex-1 bg-white/8 text-white font-semibold py-4 rounded-2xl font-body text-sm active:scale-95 transition-transform border border-white/6"
                  >
                    🖼️ Gallery
                  </button>
                  <button
                    onClick={handleLeaveRoom}
                    className="flex-[2] bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lifted active:scale-95 transition-transform font-body"
                  >
                    🏠 Back Home
                  </button>
                </motion.div>

              ) : isSolo ? (
                /* ── Solo: gallery + play again ─────────────────────────────── */
                <motion.div key="solo" className="flex gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <button
                    onClick={() => navigate('/gallery')}
                    className="flex-1 bg-white/8 text-white font-semibold py-4 rounded-2xl font-body text-sm active:scale-95 transition-transform border border-white/6"
                  >
                    🖼️ Gallery
                  </button>
                  <button
                    onClick={handleAgain}
                    className="flex-[2] bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lifted active:scale-95 transition-transform font-body"
                  >
                    🔄 Play Again
                  </button>
                </motion.div>

              ) : (
                /* ── Multiplayer: asymmetric Leave Room (left) + Again (right) ── */
                <motion.div key="multi" className="flex gap-3 items-stretch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

                  {/* Leave Room — smaller, red, secondary */}
                  <div className="flex flex-col justify-between bg-red-500/8 border border-red-500/15 rounded-3xl p-4 flex-[2] gap-3">
                    <div>
                      <div className="text-xl mb-1.5">🚪</div>
                      <p className="text-red-400 font-body text-sm font-semibold leading-tight">Leave Room</p>
                      <p className="text-red-400/45 font-body text-[11px] leading-tight mt-0.5">End this session</p>
                    </div>
                    <button
                      onClick={handleLeaveRoom}
                      className="w-full bg-red-500/15 text-red-400 font-semibold py-2.5 rounded-xl font-body text-sm active:scale-95 transition-transform border border-red-500/20"
                    >
                      Leave
                    </button>
                  </div>

                  {/* Play Again — larger, blue, primary CTA */}
                  <div className="flex flex-col justify-between bg-blue-500/12 border border-blue-500/25 rounded-3xl p-4 flex-[3] gap-3">
                    <div>
                      <div className="text-xl mb-1.5">🔄</div>
                      <p className="text-blue-200 font-body text-sm font-semibold leading-tight">Again</p>
                      <p className="text-blue-200/45 font-body text-[11px] leading-tight mt-0.5">Create another masterpiece</p>
                    </div>
                    <button
                      onClick={handleAgain}
                      className="w-full bg-blue-500 text-white font-bold py-2.5 rounded-xl font-body text-sm active:scale-95 transition-transform shadow-lifted"
                    >
                      Play Again
                    </button>
                  </div>

                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

        </motion.div>
      )}

      {/* Artwork naming modal */}
      <AnimatePresence>
        {showNameModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-50"
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="bg-cream w-full max-w-lg rounded-t-3xl p-6 pb-10"
            >
              <div className="text-center mb-5">
                <div className="text-4xl mb-2">✏️</div>
                <h2 className="font-display text-2xl text-ink mb-1" style={{ fontFamily: "'Fredoka One', cursive" }}>
                  Name your artwork
                </h2>
                <p className="text-ink/50 font-body text-sm">Give your masterpiece a name before saving it to your gallery.</p>
              </div>
              <input
                type="text"
                value={artworkName}
                onChange={e => setArtworkName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                placeholder="My Artwork"
                maxLength={50}
                className="w-full text-center text-lg font-body bg-white rounded-2xl px-4 py-3.5 border-2 border-ink/10 focus:border-blue-400 outline-none transition-colors text-ink mb-4"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { doSaveArtwork('My Artwork'); setShowNameModal(false) }}
                  className="flex-1 bg-white text-ink/60 font-semibold py-3.5 rounded-2xl border border-ink/10 font-body active:scale-95 transition-transform text-sm"
                >
                  Skip
                </button>
                <button
                  onClick={handleSaveName}
                  className="flex-[2] bg-blue-500 text-white font-bold py-3.5 rounded-2xl shadow-lifted active:scale-95 transition-transform font-body"
                >
                  Save to Gallery 🖼️
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gallery save feedback — success or honest quota failure */}
      <AnimatePresence>
        {saveResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`fixed left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-2xl font-body text-sm font-semibold shadow-deep ${
              saveResult === 'saved' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}
            style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
          >
            {saveResult === 'saved'
              ? (user ? '✓ Saved to your account gallery' : '✓ Saved to your gallery')
              : '⚠️ Couldn’t save — device storage is full. Free up space and try again.'}
            {saveResult === 'saved' && !user && (
              <button
                onClick={() => { setSaveResult(null); setShowAuthPrompt(true) }}
                className="block w-full mt-1.5 text-white/90 underline underline-offset-2 text-[12px] font-body"
              >
                Save it forever — create a free account
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post-save account prompt (guest only) */}
      <AnimatePresence>
        {showAuthPrompt && (
          <AuthModal
            title="Save this artwork forever"
            onClose={() => setShowAuthPrompt(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
