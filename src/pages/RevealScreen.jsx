import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { getPageById } from '../lib/coloringPages'
import { subscribeToSession, getOrCreatePlayerId, getOrCreatePlayerName, getAllStrokes, resetRound, setPlayerWantsAgain, leaveRoom, createSession } from '../lib/session'
import { getProfile } from '../lib/profile'
import { buildAllowedMask, buildRevealMask, buildPolygonMask, buildRevealPolygonMask, smoothPoints, drawStroke } from '../lib/canvasUtils'
import { saveArtwork, compressImageDataUrl, markArtworkMigrated, loadGallery } from '../lib/gallery'
import { saveArtworkToCloud } from '../lib/cloudGallery'
import useAuth from '../hooks/useAuth'
import AuthModal from '../components/AuthModal'
import { generateRevealVideo, shareOrDownloadVideo, shareOrDownloadImage, isRevealVideoSupported } from '../lib/revealVideo'
import { copyText } from '../lib/share'
import TimeLapsePlayer from '../components/TimeLapsePlayer'
import MaskedTearReplay from '../components/MaskedTearReplay'

const CONFETTI_DOTS = [
  { size: 10, color: '#8B6EF8', pos: { top: -10, left: '18%' },    delay: 0.18, dur: 3.1 },
  { size:  7, color: '#FF6B8A', pos: { top:  -8, left: '55%' },    delay: 0.28, dur: 2.8 },
  { size:  9, color: '#FFD166', pos: { top: -12, left: '80%' },    delay: 0.22, dur: 3.4 },
  { size:  8, color: '#74C7EC', pos: { bottom:  -9, left: '25%' }, delay: 0.35, dur: 2.9 },
  { size: 10, color: '#8B6EF8', pos: { bottom: -11, left: '65%' }, delay: 0.20, dur: 3.2 },
  { size:  7, color: '#FF6B8A', pos: { top: '22%', left:  -8 },    delay: 0.30, dur: 3.0 },
  { size:  9, color: '#FFD166', pos: { top: '58%', left: -10 },    delay: 0.15, dur: 3.5 },
  { size:  8, color: '#74C7EC', pos: { top: '15%', right: -9 },    delay: 0.25, dur: 2.7 },
  { size: 11, color: '#8B6EF8', pos: { top: '70%', right: -11 },   delay: 0.32, dur: 3.3 },
  { size:  7, color: '#FF6B8A', pos: { bottom: -8, right: '20%' }, delay: 0.38, dur: 2.6 },
]

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
  if (!tearPoints?.length && !sessionData?.zones) return null

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

    const mask = sessionData?.zones?.[section]?.polygon
      ? buildRevealPolygonMask(sessionData.zones[section].polygon)
      : buildRevealMask(tearPoints, section, orientation)
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

/**
 * Render the Color Together final image by compositing Firebase PNG snapshots
 * exactly as-is, then drawing line art once on top. No masking, clipping,
 * dilation, or pixel manipulation — pure drawImage compositor.
 * Returns a PNG data URL, or null if any active player is missing a snapshot URL
 * or if any load/draw/encode step fails (caller should fall back to renderTearReveal).
 */
async function renderSnapshotReveal(sessionData, colorPage) {
  try {
    const activePlayers = Object.entries(sessionData.players || {})
      .filter(([, p]) => p.name && !p.left && p.assignedSection)

    if (activePlayers.length === 0) return null
    if (activePlayers.some(([, p]) => !p.canvasSnapshotUrl)) return null

    const loaded = await Promise.all(
      activePlayers.map(([pid, playerData]) => new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error(`Snapshot load failed for player ${pid}`))
        img.src = playerData.canvasSnapshotUrl
      }))
    )

    const final = document.createElement('canvas')
    final.width = CANVAS_SIZE
    final.height = CANVAS_SIZE
    const finalCtx = final.getContext('2d')
    finalCtx.fillStyle = '#ffffff'
    finalCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    for (const img of loaded) {
      finalCtx.globalCompositeOperation = 'source-over'
      finalCtx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
    }

    // Draw line art on top
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
  } catch (err) {
    console.warn('[ColorSplit] renderSnapshotReveal failed — falling back to stroke reconstruction:', err?.message)
    return null
  }
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
  const [soloStarting, setSoloStarting] = useState(false)
  const [soloStartError, setSoloStartError] = useState('')
  const autosaveInitiatedRef = useRef(false)

  const isSolo = sessionData?.settings?.mode === 'solo'

  // Names of other active players who have already flagged wantsAgain
  const partnersWantingAgain = Object.entries(sessionData?.players || {})
    .filter(([pid, p]) => pid !== playerId && !p.left && p.wantsAgain)
    .map(([, p]) => p.name)

  const sessionRef = useRef(null)
  const resetInitiatedRef = useRef(false)

  const colorPage = useMemo(() => {
    const pageId = sessionStorage.getItem(`colorsplit_page_${code}`)
    if (pageId) {
      if (pageId === 'upload') {
        const uploadDataUrl = sessionStorage.getItem(`colorsplit_upload_${code}`)
        return uploadDataUrl ? { id: 'upload', name: 'Custom', svgContent: null, uploadDataUrl } : null
      }
      return getPageById(pageId) || null
    }
    // Fallback 1: Firebase session document — survives tab close, always correct.
    const fbPageId = sessionData?.coloringPage?.id
    if (fbPageId && fbPageId !== 'upload') return getPageById(fbPageId) || null
    // Fallback 2: local gallery entry (offline / expired session safety net).
    const saved = loadGallery().find(a => a.code === code && a.pageId && a.pageId !== 'upload')
    return saved?.pageId ? (getPageById(saved.pageId) || null) : null
  }, [code, sessionData])

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
            // colorPage from useMemo may be null on first render if sessionData
            // state hasn't updated yet (setSessionData is async). Fall back to
            // the live subscription payload so the line art is never skipped.
            const resolvedColorPage = colorPage
              ?? (data?.coloringPage?.id && data.coloringPage.id !== 'upload'
                ? getPageById(data.coloringPage.id)
                : null)
            // Await snapshot composite before deciding which phase to show.
            // If it succeeds we skip the broken stroke animation entirely.
            const snapshotUrl = await renderSnapshotReveal(data, resolvedColorPage)
            if (snapshotUrl) {
              setCapturedUrl(snapshotUrl)
              // Skip masked-replay — go straight to slide (or reveal for zones).
              const hasTearLine = (data.tearLine?.points?.length || 0) > 0 && !data.zones
              if (hasTearLine) {
                setPhase('slide')
                setTimeout(() => setPhase('reveal'), 4500)
              } else {
                setPhase('reveal')
              }
            } else {
              // Snapshot unavailable — render strokes in background then show replay.
              renderTearReveal(all, data, resolvedColorPage)
                .then(fbDataUrl => { if (fbDataUrl) setCapturedUrl(fbDataUrl) })
                .catch(() => {})
              setPhase('masked-replay')
            }
          } else {
            // Solo / together mode: use the live canvas snapshot if available,
            // then run the timelapse for animation only.
            const snapshot = sessionStorage.getItem(`colorsplit_canvas_${code}_latest`)
            if (snapshot) { setCapturedUrl(snapshot); snapshotLoadedRef.current = true }
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
    if (autosaveInitiatedRef.current) return
    autosaveInitiatedRef.current = true
    const defaultName = colorPage?.name ? `My ${colorPage.name}` : 'My Artwork'
    doSaveArtwork(defaultName)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, capturedUrl, gallerySaved, sessionData])


  const snapshotLoadedRef = useRef(false)

  function handleCapture(dataUrl) {
    // Don't let the timelapse replay overwrite a snapshot already set from sessionStorage.
    if (snapshotLoadedRef.current) return
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
              const hasRealTearLine = (sessionData?.tearLine?.points?.length || 0) > 0
              if (hasRealTearLine && !sessionData?.zones) { setPhase('slide'); setTimeout(() => setPhase('reveal'), 4500) }
              else { setPhase('reveal') }
            })
        } else {
          const hasRealTearLine = (sessionData?.tearLine?.points?.length || 0) > 0
          if (hasRealTearLine && !sessionData?.zones) { setPhase('slide'); setTimeout(() => setPhase('reveal'), 4500) }
          else { setPhase('reveal') }
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
    const pageId = sessionStorage.getItem(`colorsplit_page_${code}`)
      || sessionData?.coloringPage?.id
      || loadGallery().find(a => a.code === code)?.pageId
      || ''
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


  const hasZones = !!sessionData?.zones
  const tearPts = sessionData?.tearLine?.points || []
  const tearOrientation = sessionData?.tearLine?.orientation ?? 'horizontal'
  const tearScale = displaySize / 400
  const tearScaled = tearPts.map(p => ({ x: p.x * tearScale, y: p.y * tearScale }))
  const w = displaySize
  const h = displaySize

  // Clip paths and slide directions depend on orientation.
  const [pieceAClip, pieceBClip, pieceAInit, pieceBInit, pieceAAnimate, pieceBAnimate] = (() => {
    const rev = [...tearScaled].reverse()
    if (tearOrientation === 'vertical') {
      // pieceA = left piece
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
    // horizontal — pieceA = top piece
    const fwd = tearScaled.map(p => `L ${p.x} ${p.y}`).join(' ')
    const bwd = rev.map(p => `L ${p.x} ${p.y}`).join(' ')
    const last = tearScaled.length - 1
    const a = tearScaled.length
      ? `path('M 0 0 L ${w} 0 L ${tearScaled[last].x} ${tearScaled[last].y} ${bwd} L 0 ${tearScaled[0].y} Z')`
      : `path('M 0 0 L ${w} 0 L ${w} ${h / 2} L 0 ${h / 2} Z')`
    const b = tearScaled.length
      ? `path('M 0 ${tearScaled[0].y} ${fwd} L ${w} ${h} L 0 ${h} Z')`
      : `path('M 0 ${h / 2} L ${w} ${h / 2} L ${w} ${h} L 0 ${h} Z')`
    return [a, b, { y: -h }, { y: h }, { y: 0 }, { y: 0 }]
  })()

  const seamPolyline = tearScaled.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <div className={`${phase === 'reveal' ? 'bg-gradient-to-b from-[#FFFDF8] via-[#FDF8F2] to-[#EDE8FF]' : 'bg-[#1a1a1a]'} flex flex-col items-center ${phase === 'reveal' ? 'h-screen overflow-y-auto justify-start' : 'min-h-screen justify-center overflow-hidden'}`}>

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
              // Only the real 2-piece tear line drives the slide phase.
              // 3-player/polygon sessions have zones and no tearLine → skip to reveal.
              if (tearPts.length > 0 && !hasZones) {
                setPhase('slide')
                setTimeout(() => setPhase('reveal'), 4500)
              } else {
                setPhase('reveal')
              }
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
                <polyline points={seamPolyline} fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.35" />
                <polyline points={seamPolyline} fill="none" stroke="white" strokeWidth="4" strokeOpacity="0.08" />
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
          className="flex flex-col items-center w-full px-5 max-w-lg gap-3"
          style={{
            paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
            paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
          }}
        >

          {/* ── 1. Header ────────────────────────────────────────────────────── */}
          <motion.div
            initial={{ y: -16, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 0.05, type: 'spring', stiffness: 280, damping: 24 }}
            className="text-center"
          >
            <div className="text-4xl mb-2">🎉</div>
            <h1
              className="font-display text-3xl text-gray-900 leading-tight"
              style={{ fontFamily: "'Fredoka One', cursive" }}
            >
              Masterpiece!
            </h1>
            <p className="text-gray-500 font-body text-sm mt-1">
              {isSolo ? 'Saved to your gallery.' : 'Made together. Saved to your gallery.'}
            </p>
            {leftPlayerNames.length > 0 && (
              <p className="text-amber-700 font-body text-xs mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 inline-block">
                👋 {leftPlayerNames.join(' & ')} left earlier — their coloring is still part of the artwork.
              </p>
            )}
          </motion.div>

          {/* ── 2. Artwork hero + celebration ────────────────────────────────── */}
          <div className="relative w-full max-w-[340px] mb-2" style={{ overflow: 'visible' }}>
            {/* Soft radial glow behind the card */}
            <div
              className="absolute pointer-events-none"
              style={{
                inset: -24,
                background: 'radial-gradient(ellipse at center, rgba(139,110,248,0.22) 0%, rgba(255,107,138,0.1) 45%, transparent 70%)',
                filter: 'blur(16px)',
                borderRadius: '50%',
                zIndex: 0,
              }}
            />

            {/* Decorative confetti dots — pointer-events: none, never block taps */}
            {CONFETTI_DOTS.map((dot, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full pointer-events-none"
                style={{ width: dot.size, height: dot.size, background: dot.color, ...dot.pos, zIndex: 2 }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.85, y: [0, -4, 0] }}
                transition={{
                  scale: { type: 'spring', stiffness: 380, damping: 14, delay: dot.delay },
                  opacity: { duration: 0.25, delay: dot.delay },
                  y: { duration: dot.dur, repeat: Infinity, ease: 'easeInOut', delay: dot.delay + 0.4 },
                }}
              />
            ))}

            {/* Artwork card */}
            <motion.div
              className="w-full rounded-3xl overflow-hidden bg-white relative"
              style={{ aspectRatio: '1', boxShadow: '0 0 32px rgba(124,92,255,0.18), 0 8px 20px rgba(0,0,0,0.07)', zIndex: 1 }}
              initial={{ scale: 0.88, opacity: 0, rotate: -1.5 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
            >
              {capturedUrl ? (
                <img src={capturedUrl} alt="Masterpiece" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-50 text-5xl">🎨</div>
              )}
            </motion.div>
          </div>

          {/* ── 3. Utility row ───────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, type: 'spring', stiffness: 260, damping: 24 }}
            className="w-full grid grid-cols-3 gap-2.5"
          >
            {/* Replay */}
            <button
              onClick={handleReplay}
              className="flex flex-col items-center gap-1.5 bg-white border border-gray-100 rounded-2xl py-2.5 px-2 active:scale-95 transition-transform shadow-sm"
            >
              <span className="text-xl">🔁</span>
              <span className="text-gray-800 font-body text-xs font-semibold">Replay</span>
            </button>

            {/* Download as PNG */}
            <button
              onClick={handleSave}
              disabled={!capturedUrl}
              className="flex flex-col items-center gap-1.5 bg-white border border-gray-100 rounded-2xl py-2.5 px-2 active:scale-95 transition-all shadow-sm disabled:opacity-40"
            >
              <span className="text-xl">⬇️</span>
              <span className="text-gray-800 font-body text-xs font-semibold">Download</span>
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              className="flex flex-col items-center gap-1.5 bg-white border border-gray-100 rounded-2xl py-2.5 px-2 active:scale-95 transition-transform shadow-sm"
            >
              <span className="text-xl">{shareMsg ? (shareMsg.includes('failed') ? '⚠️' : '✓') : '🔗'}</span>
              <span className="text-gray-800 font-body text-xs font-semibold">{shareMsg || 'Share'}</span>
            </button>
          </motion.div>

          {/* ── 3b. Share reveal video ───────────────────────────────────────── */}
          <motion.button
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, type: 'spring', stiffness: 260, damping: 24 }}
            onClick={handleShareVideo}
            disabled={!capturedUrl || videoState === 'rendering'}
            className="w-full bg-white/60 border border-gray-200 rounded-xl py-2.5 px-4 active:scale-[0.98] transition-transform disabled:opacity-60 relative overflow-hidden"
          >
            {videoState === 'rendering' && (
              <div
                className="absolute inset-y-0 left-0 bg-violet-500/25 transition-all"
                style={{ width: `${Math.round(videoProgress * 100)}%` }}
              />
            )}
            <span className="relative flex items-center justify-center gap-2 text-gray-400 font-body text-xs font-medium text-center">
              {videoState === 'rendering' && <>🎬 Creating your reveal video… {Math.round(videoProgress * 100)}%</>}
              {videoState === 'shared' && <>✓ Shared!</>}
              {videoState === 'downloaded' && <>✓ Video saved!</>}
              {videoState === 'image-shared' && <>✓ Shared image (video not supported here)</>}
              {videoState === 'image-saved' && <>✓ Image saved (video not supported here)</>}
              {videoState === 'error' && <>😕 Couldn't create the video — try again</>}
              {videoState === 'idle' && <>🎬 Share reveal video</>}
            </span>
          </motion.button>

          {/* ── 4. Navigation row ────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 260, damping: 24 }}
            className="w-full"
          >
            {/* Partner nudge — subtle banner when partner already clicked Again */}
            <AnimatePresence>
              {!isSolo && !wantsAgain && partnersWantingAgain.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="w-full bg-violet-50 border border-violet-200 rounded-2xl px-4 py-2.5 text-center mb-3 overflow-hidden"
                >
                  <p className="text-violet-600 font-body text-xs">
                    🎮 {partnersWantingAgain.join(' & ')} wants to play again
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Waiting state / navigation rows ─────────────────────────────── */}
            <AnimatePresence mode="wait">
              {wantsAgain ? (
                <motion.div
                  key="waiting"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                  className="w-full bg-white border border-gray-100 rounded-3xl px-5 py-5 flex flex-col gap-4 shadow-sm"
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1.5">⏳</div>
                    <p className="text-gray-700 font-body text-sm font-semibold">
                      Waiting for your coloring buddy…
                    </p>
                  </div>

                  {/* Per-player status rows */}
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
                            : <motion.span
                                animate={{ opacity: [0.4, 1, 0.4] }}
                                transition={{ repeat: Infinity, duration: 1.6 }}
                                className="text-gray-400 font-body text-sm"
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
                </motion.div>

              ) : (!isSolo && Object.entries(sessionData?.players || {})
                    .filter(([pid, p]) => pid !== playerId && p.name && !p.left).length === 0) ? (
                /* ── Everyone else left: solo CTA primary, nav row below ────────── */
                <motion.div key="alone" className="flex flex-col gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <button
                    onClick={handleStartSolo}
                    disabled={soloStarting}
                    className="w-full text-white font-bold py-4 rounded-2xl shadow-lifted active:scale-95 transition-transform font-body disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #8B6EF8 0%, #7C5CFF 100%)' }}
                  >
                    {soloStarting ? '…Starting solo…' : '🎨 Start Solo Coloring'}
                  </button>
                  {soloStartError && (
                    <p className="text-red-500 font-body text-xs text-center -mt-1">{soloStartError}</p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={handleLeaveRoom}
                      className="flex-1 bg-white text-gray-600 font-semibold py-3.5 rounded-2xl font-body text-sm active:scale-95 transition-transform border border-gray-200 shadow-sm"
                    >
                      🏠 Back Home
                    </button>
                    <button
                      onClick={() => navigate('/gallery')}
                      className="flex-1 bg-white text-gray-800 font-semibold py-3.5 rounded-2xl font-body text-sm active:scale-95 transition-transform border border-gray-200 shadow-sm"
                    >
                      🖼️ View Gallery
                    </button>
                  </div>
                </motion.div>

              ) : isSolo ? (
                /* ── Solo: Home left, View Gallery right ────────────────────────── */
                <motion.div key="solo" className="flex gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <button
                    onClick={() => navigate('/', { replace: true })}
                    className="flex-1 bg-white text-gray-600 font-semibold py-3.5 rounded-2xl font-body text-sm active:scale-95 transition-transform border border-gray-200 shadow-sm"
                  >
                    🏠 Home
                  </button>
                  <button
                    onClick={() => navigate('/gallery')}
                    className="flex-1 bg-white text-gray-800 font-semibold py-3.5 rounded-2xl font-body text-sm active:scale-95 transition-transform border border-gray-200 shadow-sm"
                  >
                    🖼️ View Gallery
                  </button>
                </motion.div>

              ) : (
                /* ── Multiplayer: Leave Room left, View Gallery right ────────────── */
                <motion.div key="multi" className="flex gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <button
                    onClick={handleLeaveRoom}
                    className="flex-1 bg-white text-red-400 font-semibold py-3.5 rounded-2xl font-body text-sm active:scale-95 transition-transform border border-red-200 shadow-sm"
                  >
                    🚪 Leave Room
                  </button>
                  <button
                    onClick={() => navigate('/gallery')}
                    className="flex-1 bg-white text-gray-800 font-semibold py-3.5 rounded-2xl font-body text-sm active:scale-95 transition-transform border border-gray-200 shadow-sm"
                  >
                    🖼️ View Gallery
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ── 5. Play Again — bottom primary (solo + multi only) ──────────── */}
          <AnimatePresence>
            {!wantsAgain && !(
              !isSolo && Object.entries(sessionData?.players || {})
                .filter(([pid, p]) => pid !== playerId && p.name && !p.left).length === 0
            ) && (
              <motion.button
                key="play-again"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ delay: 0.55, type: 'spring', stiffness: 260, damping: 24 }}
                onClick={handleAgain}
                className="w-full text-white font-bold py-4 rounded-2xl shadow-lifted active:scale-95 transition-transform font-body"
                style={{ background: 'linear-gradient(135deg, #8B6EF8 0%, #7C5CFF 100%)' }}
              >
                🔄 Play Again
              </motion.button>
            )}
          </AnimatePresence>

        </motion.div>
      )}

      {/* Gallery save feedback — success or honest quota failure */}
      <AnimatePresence>
        {saveResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed left-0 right-0 flex justify-center z-[60] px-4"
            style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
          >
            <div className={`px-4 py-2.5 rounded-2xl font-body text-sm font-semibold shadow-deep ${
              saveResult === 'saved' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}>
              {saveResult === 'saved'
                ? (user ? '✓ Saved to your account gallery' : '✓ Saved to your gallery')
                : `⚠️ Couldn't save — device storage is full. Free up space and try again.`}
              {saveResult === 'saved' && !user && (
                <button
                  onClick={() => { setSaveResult(null); setShowAuthPrompt(true) }}
                  className="block w-full mt-1.5 text-white/90 underline underline-offset-2 text-[12px] font-body"
                >
                  Save it forever — create a free account
                </button>
              )}
            </div>
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
