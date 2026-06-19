import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  subscribeToSession, subscribeToStrokes, addStroke, getAllStrokes,
  setPlayerDone, updatePlayerProgress, updateSessionStatus, getOrCreatePlayerId,
  updateLiveStroke, clearLiveStroke, subscribeToLiveStrokes, leaveRoom,
  setupPresence, removeStroke, setStrokeWithId, setMyStrokes, normalizeSection,
  uploadPlayerSnapshot, setPlayerSnapshotUrl,
} from '../lib/session'
import { getPageById } from '../lib/coloringPages'
import { AVATAR_COLORS } from '../lib/profile'
import { buildRevealMask, buildPolygonMask, smoothPoints, drawStroke } from '../lib/canvasUtils'
import ColorPicker from '../components/ColorPicker'
import Toolbar from '../components/Toolbar'
import LeaveRoomModal from '../components/LeaveRoomModal'

const CANVAS_SIZE = 800
const MAX_ZOOM = 6
const MIN_ZOOM = 0.7

// Convert 0–255 RGB channels to an uppercase #RRGGBB hex string.
function rgbToHex(r, g, b) {
  const h = n => n.toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase()
}

// Playful, motivating progress wording — short, positive, never competitive.
// Contextual: low = encouraging start, mid = motivating, high = almost there.
// Multiplayer variants lean into the teamwork feeling.
function progressPhrase(pct, solo) {
  if (pct >= 95) return solo ? 'Masterpiece complete! 🎉' : 'Great teamwork! 🎉'
  if (pct >= 80) return solo ? 'Almost there! ✨' : 'Almost there together! ✨'
  if (pct >= 55) return solo ? 'Coming alive! 🎨' : 'It’s coming alive! 🎨'
  if (pct >= 30) return solo ? 'Looking good!' : 'Looking good together!'
  if (pct >= 10) return solo ? 'Keep coloring!' : 'Nice teamwork so far!'
  return solo ? 'Nice start!' : 'Nice start — together! 🖍️'
}

function getDistance(p1, p2) {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
}

// Draw the torn-section mask on a canvas context
function applyTearMask(maskCanvas, tearPoints, section) {
  if (!tearPoints?.length || !section) return
  const ctx = maskCanvas.getContext('2d')
  const scale = CANVAS_SIZE / 400
  const scaled = tearPoints.map(p => ({ x: p.x * scale, y: p.y * scale }))
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  ctx.fillStyle = 'rgba(28,28,28,0.92)'
  ctx.beginPath()
  if (normalizeSection(section) === 'zone0') {
    // Hide the BOTTOM section (below tear line)
    ctx.moveTo(scaled[0].x, scaled[0].y)
    scaled.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.lineTo(CANVAS_SIZE, CANVAS_SIZE)
    ctx.lineTo(0, CANVAS_SIZE)
  } else {
    // Hide the TOP section (above tear line)
    ctx.moveTo(0, 0)
    ctx.lineTo(CANVAS_SIZE, 0)
    ctx.lineTo(scaled[scaled.length - 1].x, scaled[scaled.length - 1].y)
    scaled.slice().reverse().forEach(p => ctx.lineTo(p.x, p.y))
  }
  ctx.closePath()
  ctx.fill()
}

export default function ColoringSession() {
  const { code } = useParams()
  const navigate = useNavigate()

  // ?as=PLAYERID lets a player reclaim their session on a new device
  const forcedId = new URLSearchParams(window.location.search).get('as')
  if (forcedId) {
    localStorage.setItem('colorsplit_player_id', forcedId)
    window.history.replaceState({}, '', window.location.pathname)
  }
  const playerId = getOrCreatePlayerId()

  const [session, setSession] = useState(null)
  const [colorPage, setColorPage] = useState(null)
  const [tool, setTool] = useState('pencil')
  const [color, setColor] = useState('#4F8EF7')
  const [opacity, setOpacity] = useState(1.0)
  const [pencilSize, setPencilSize] = useState(14)
  const [eraserSize, setEraserSize] = useState(24)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [recentColors, setRecentColors] = useState(['#4F8EF7', '#E03232', '#74AF77', '#FF9B2E', '#9B59B6'])
  const [soloPalette, setSoloPalette] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [panMode, setPanMode] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [donePhase, setDonePhase] = useState(null) // null | 'uploading' | 'waiting'
  const [othersDoneNames, setOthersDoneNames] = useState([])
  const [partnerDoneToast, setPartnerDoneToast] = useState(null) // { message, colorHex } | null
  const [showDoneConfirm, setShowDoneConfirm] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leftPlayerNames, setLeftPlayerNames] = useState([])
  const [progress, setProgress] = useState(0)
  const [otherProgress, setOtherProgress] = useState({})
  const [containerSize, setContainerSize] = useState(375)
  const [pickFeedback, setPickFeedback] = useState(null)

  const canvasRef = useRef(null)
  const strokeCanvasRef = useRef(null)
  const remoteCanvasRef = useRef(null)
  const contourCanvasRef = useRef(null)
  const maskCanvasRef = useRef(null)
  const containerRef = useRef(null)
  const isDrawingRef = useRef(false)
  const currentStrokeRef = useRef([])
  const historyRef = useRef([])
  const redoStackRef = useRef([])
  // Undo/redo must mirror to Firebase, otherwise a refresh (resume) or the
  // reveal timelapse resurrects undone strokes. actionsRef stays index-aligned
  // with historyRef; each entry describes how to undo/redo the Firebase side.
  const preStrokeSnapshotRef = useRef(null) // canvas snapshot taken at stroke start
  const actionsRef = useRef([])             // { type:'stroke', id, stroke } | { type:'reset', strokes }
  const redoActionsRef = useRef([])
  const myStrokesRef = useRef({})           // local mirror of my committed Firebase strokes
  const lastProgressRef = useRef(0)
  const lastLiveUpdateRef = useRef(0)
  const lastRenderedIndexRef = useRef(0)
  const touchesRef = useRef([])
  const lastPinchDistRef = useRef(null)
  const lastPanRef = useRef(null)
  const isPanningRef = useRef(false)
  const committedRemoteStrokesRef = useRef({})
  const liveRemoteStrokesRef = useRef({})
  const clipSectionRef = useRef({ points: null, section: null })
  const panModeRef = useRef(false)
  const mousePanRef = useRef(null)
  const allowedMaskCanvasRef = useRef(null)
  const allowedAreaRef = useRef(null) // opaque pixel count of the allowed mask (tear mode progress denominator)
  const maskKeyRef = useRef(null)
  const isLeavingRef = useRef(false)
  const prevToolRef = useRef('pencil')   // tool to restore after an eyedropper pick
  const pickTimerRef = useRef(null)       // clears the "Color picked" toast
  const zoomRef = useRef(1)               // current zoom, readable from no-dep handlers
  const containerSizeRef = useRef(375)    // current container px, readable from no-dep handlers
  const lastTapRef = useRef(0)            // double-tap-to-reset detection
  const gesturePinchedRef = useRef(false) // a 2-finger gesture happened this touch sequence
  const pendingStrokeWritesRef = useRef(new Set()) // tracks in-flight addStroke promises for flush-before-done

  // Derived from state — must be declared before any useCallback that references it in deps
  const size = tool === 'eraser' ? eraserSize : pencilSize

  // Load solo palette
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`colorsplit_palette_${code}`)
      const p = raw ? JSON.parse(raw) : null
      if (p?.length) {
        setSoloPalette(p)
        setColor(p[0])
        setRecentColors(p)
      }
    } catch {}
  }, [code])

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const { width, height } = e.contentRect
        setContainerSize(Math.min(width, height))
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Auto-hide toast when a partner marks themselves done
  const prevDoneNamesRef = useRef([])
  useEffect(() => {
    const prev = prevDoneNamesRef.current
    const newlyDone = othersDoneNames.filter(n => !prev.includes(n))
    if (newlyDone.length > 0) {
      const doneName = newlyDone[0]
      const donePlayer = Object.values(otherProgress).find(p => p.name === doneName)
      const colorHex = AVATAR_COLORS.find(c => c.id === donePlayer?.colorId)?.hex || null
      setPartnerDoneToast({ message: `${doneName} is ready ✨`, colorHex })
      const t = setTimeout(() => setPartnerDoneToast(null), 4000)
      prevDoneNamesRef.current = othersDoneNames
      return () => clearTimeout(t)
    }
    prevDoneNamesRef.current = othersDoneNames
  }, [othersDoneNames.join(',')])

  // Presence: only set up after session confirms this player is a real participant.
  // Calling setupPresence for an unknown playerId would create a phantom player entry in Firebase.
  const [isPlayerValid, setIsPlayerValid] = useState(false)
  useEffect(() => {
    if (!isPlayerValid) return
    return setupPresence(code, playerId)
  }, [isPlayerValid, code, playerId])


  // Session subscription
  useEffect(() => {
    const unsub = subscribeToSession(code, (data) => {
      if (!data) return
      if (isLeavingRef.current) return
      if (!data.players) {
        console.warn('[ColorSplit] Session received without players node:', data)
      }
      // Unknown player: not in this session — send to join instead of creating a phantom entry
      if (!data.players?.[playerId]) { navigate(`/join/${code}`, { replace: true }); return }
      setIsPlayerValid(true)

      // Fairness: another player leaving must NEVER block or erase this player's
      // work. Track who left for an informational banner and keep going — their
      // strokes stay in the artwork and the remaining player can finish alone.
      const leftNames = Object.entries(data.players || {})
        .filter(([pid, p]) => pid !== playerId && p.left)
        .map(([, p]) => p.name || 'A player')
      setLeftPlayerNames(leftNames)
      setSession(data)
      // Restore done-state after a refresh so the player can't keep coloring.
      if (data.players?.[playerId]?.done) setIsDone(true)
      clipSectionRef.current = {
        points: data.tearLine?.points ?? null,
        section: data.players?.[playerId]?.assignedSection ?? null,
        orientation: data.tearLine?.orientation ?? 'horizontal',
      }
      if (data.status === 'done') navigate(`/session/${code}/reveal`)

      // Only count real players (with a name); players who left don't gate
      // completion — the remaining players can finish without them.
      const activePlayers = Object.values(data.players || {}).filter(p => p.name && !p.left)
      if (activePlayers.length > 0 && activePlayers.every(p => p.done)) {
        if (data.status !== 'done') {
          updateSessionStatus(code, 'done').catch(() => {})
        }
        navigate(`/session/${code}/reveal`)
      }

      const others = {}
      Object.entries(data.players || {}).forEach(([pid, p]) => {
        if (pid !== playerId) others[pid] = p
      })
      setOtherProgress(others)

      const doneOthers = Object.entries(data.players || {})
        .filter(([pid, p]) => pid !== playerId && p.done && !p.left)
        .map(([, p]) => p.name || 'Other player')
      setOthersDoneNames(doneOthers)

      if (!colorPage && data.coloringPage) {
        const page = getPageById(data.coloringPage.id)
        if (page) {
          setColorPage(page)
          sessionStorage.setItem(`colorsplit_page_${code}`, data.coloringPage.id)
        }
      }
    })
    return unsub
  }, [code, colorPage])

  // Detect uploaded image and create a synthetic colorPage from it
  useEffect(() => {
    if (colorPage) return // already loaded via session subscription
    const uploadDataUrl = sessionStorage.getItem(`colorsplit_upload_${code}`)
    if (uploadDataUrl) {
      setColorPage({ id: 'upload', name: 'Custom Image', svgContent: null, uploadDataUrl })
    }
  }, [code, colorPage])

  // Draw contour overlay — handles both SVG pages and uploaded dataURL images
  useEffect(() => {
    if (!contourCanvasRef.current) return
    const canvas = contourCanvasRef.current
    const ctx = canvas.getContext('2d')

    if (colorPage?.svgContent) {
      const img = new Image()
      const blob = new Blob([colorPage.svgContent], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      img.onload = () => {
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
        ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
        URL.revokeObjectURL(url)
        applyAllowedMask(ctx) // no-op if mask not ready yet (Edit 1 handles retroactive apply)
      }
      img.src = url
    } else if (colorPage?.uploadDataUrl || colorPage?.imageUrl) {
      // Uploaded data URL or a built-in image-page URL — both load the same way.
      const img = new Image()
      img.onload = () => {
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
        ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
        applyAllowedMask(ctx) // no-op if mask not ready yet
      }
      img.src = colorPage.uploadDataUrl || colorPage.imageUrl
    }
  }, [colorPage])

  // Apply tear mask + build allowed-section mask when session + section is ready
  useEffect(() => {
    if (!maskCanvasRef.current) return
    const mode = session?.settings?.mode
    const tearPoints = session?.tearLine?.points
    const mySection = session?.players?.[playerId]?.assignedSection
    const tearOrientation = session?.tearLine?.orientation ?? 'horizontal'
    const zones = session?.zones
    const zonePolygon = zones?.[mySection]?.polygon
    if (mode === 'tear' && mySection && (tearPoints || zones)) {
      maskCanvasRef.current.getContext('2d').clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      const maskKey = zonePolygon
        ? `poly_${mySection}_${zonePolygon.map(p => `${p.x},${p.y}`).join('|')}`
        : `${mySection}_${tearOrientation}_${tearPoints.length}_${tearPoints[0]?.x}_${tearPoints[0]?.y}`
      if (maskKeyRef.current !== maskKey) {
        maskKeyRef.current = maskKey
        const isFirstBuild = !allowedMaskCanvasRef.current
        // Use buildRevealMask (seam+2px) so the allowed drawing area matches exactly
        // what RevealScreen will reveal — preventing seam dead-zone gaps.
        allowedMaskCanvasRef.current = zonePolygon
          ? buildPolygonMask(zonePolygon)
          : buildRevealMask(tearPoints, mySection, tearOrientation)
        // Count the section's pixels once — progress is measured against this, not the full canvas.
        {
          const md = allowedMaskCanvasRef.current.getContext('2d').getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data
          let n = 0
          for (let i = 3; i < md.length; i += 4) if (md[i] > 128) n++
          allowedAreaRef.current = n
        }
        if (isFirstBuild) {
          // If strokes were restored from Firebase before the mask was ready, clean them now.
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d')
            ctx.save()
            ctx.globalCompositeOperation = 'destination-in'
            ctx.drawImage(allowedMaskCanvasRef.current, 0, 0)
            ctx.restore()
          }
          // If the contour loaded before the mask was ready, mask it now too.
          if (contourCanvasRef.current) {
            const ctx = contourCanvasRef.current.getContext('2d')
            ctx.save()
            ctx.globalCompositeOperation = 'destination-in'
            ctx.drawImage(allowedMaskCanvasRef.current, 0, 0)
            ctx.restore()
          }
        }
      }
    } else {
      // Clear mask if not tear mode
      maskCanvasRef.current.getContext('2d').clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      allowedMaskCanvasRef.current = null
      allowedAreaRef.current = null
      maskKeyRef.current = null
    }
  }, [session, playerId])

  function redrawRemoteCanvas() {
    const canvas = remoteCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    // Committed strokes first
    for (const strokes of Object.values(committedRemoteStrokesRef.current)) {
      for (const stroke of Object.values(strokes)) {
        if (!stroke.points?.length) continue
        drawStroke(ctx, stroke)
      }
    }
    // Live stroke on top
    for (const stroke of Object.values(liveRemoteStrokesRef.current)) {
      if (!stroke?.points?.length) continue
      drawStroke(ctx, stroke)
    }
  }

  // Clip drawing to the player's assigned section using the tear line polygon.
  // Reads clipSectionRef (a ref) so it never causes stale-closure issues in callbacks.
  //
  // CLIP_OVERLAP: extend each zone's clip boundary this many px PAST the seam into
  //   the other player's territory. Combined with buildRevealMask (SEAM=2) as the
  //   allowed mask, the effective drawing boundary is seam+2px — exactly matching
  //   what RevealScreen reveals. This prevents any dead-zone gap at the seam.
  // CLIP_EDGE: extend the polygon this many px beyond each canvas edge so that
  //   no drawable canvas pixel ever lies exactly on the polygon boundary.
  //   Without this, pixels at x=0 (where the tear also starts) are "on the boundary"
  //   and the winding rule is ambiguous — causing the far-left-edge leak.
  const CLIP_OVERLAP = 4
  const CLIP_EDGE = 2

  function buildClipPath(ctx) {
    const { points, section, orientation = 'horizontal' } = clipSectionRef.current
    if (!points || !section) return
    const scale = CANVAS_SIZE / 400
    const CE = CLIP_EDGE, CO = CLIP_OVERLAP
    const W = CANVAS_SIZE, H = CANVAS_SIZE
    const isZone0 = normalizeSection(section) === 'zone0'
    let sc
    if (orientation === 'vertical') {
      const dx = isZone0 ? CO : -CO   // extend INTO other zone (applyAllowedMask is the binding clip)
      sc = points.map(p => ({ x: p.x * scale + dx, y: p.y * scale }))
    } else {
      const dy = isZone0 ? CO : -CO   // extend INTO other zone (applyAllowedMask is the binding clip)
      sc = points.map(p => ({ x: p.x * scale, y: p.y * scale + dy }))
    }
    const last = sc.length - 1
    ctx.beginPath()
    if (orientation === 'vertical') {
      if (isZone0) {
        ctx.moveTo(-CE, -CE); ctx.lineTo(sc[0].x, -CE)
        for (let i = 0; i <= last; i++) ctx.lineTo(sc[i].x, sc[i].y)
        ctx.lineTo(sc[last].x, H + CE); ctx.lineTo(-CE, H + CE)
      } else {
        ctx.moveTo(sc[0].x, -CE); ctx.lineTo(W + CE, -CE)
        ctx.lineTo(W + CE, H + CE); ctx.lineTo(sc[last].x, H + CE)
        for (let i = last; i >= 0; i--) ctx.lineTo(sc[i].x, sc[i].y)
      }
    } else {
      if (isZone0) {
        ctx.moveTo(-CE, -CE); ctx.lineTo(W + CE, -CE); ctx.lineTo(W + CE, sc[last].y)
        ctx.lineTo(sc[last].x, sc[last].y)
        for (let i = last - 1; i >= 0; i--) ctx.lineTo(sc[i].x, sc[i].y)
        ctx.lineTo(-CE, sc[0].y)
      } else {
        ctx.moveTo(-CE, sc[0].y); ctx.lineTo(sc[0].x, sc[0].y)
        for (let i = 1; i <= last; i++) ctx.lineTo(sc[i].x, sc[i].y)
        ctx.lineTo(W + CE, sc[last].y); ctx.lineTo(W + CE, H + CE); ctx.lineTo(-CE, H + CE)
      }
    }
    ctx.closePath(); ctx.clip()
  }

  // Hard-erase any pixels outside the player's allowed section.
  // Uses destination-in so only pixels overlapping the opaque mask survive.
  // This is the final guarantee — clip path is the first pass, this is the second.
  function applyAllowedMask(targetCtx) {
    const mask = allowedMaskCanvasRef.current
    if (!mask) return
    targetCtx.save()
    targetCtx.globalCompositeOperation = 'destination-in'
    targetCtx.drawImage(mask, 0, 0)
    targetCtx.restore()
  }

  // Restore own committed strokes from Firebase after a page reload.
  // Runs once on mount; does not re-run per stroke.
  useEffect(() => {
    let cancelled = false
    getAllStrokes(code).then(allStrokes => {
      if (cancelled || !canvasRef.current) return
      const myStrokes = allStrokes?.[playerId]
      if (!myStrokes) return
      myStrokesRef.current = { ...myStrokes }
      const ctx = canvasRef.current.getContext('2d')
      Object.values(myStrokes)
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        .forEach(stroke => {
          if (!stroke?.points?.length) return
          drawStroke(ctx, stroke)
        })
      applyAllowedMask(ctx)
      calculateProgress()
    }).catch(() => {})
    return () => { cancelled = true }
  }, [code, playerId])

  // Subscribe to committed remote strokes (together + live mode)
  useEffect(() => {
    if (!session) return
    const { mode, visibility } = session.settings || {}
    if (mode !== 'together' || visibility !== 'live') return
    const others = Object.keys(session.players || {}).filter(p => p !== playerId)
    if (others.length === 0) return
    const unsubs = others.map(pid =>
      subscribeToStrokes(code, pid, (strokes) => {
        committedRemoteStrokesRef.current[pid] = strokes || {}
        redrawRemoteCanvas()
      })
    )
    return () => unsubs.forEach(u => u())
    // Note: refs intentionally NOT cleared on cleanup to prevent canvas flicker during re-subscription
  }, [session, code, playerId])

  // Subscribe to live (in-progress) remote strokes
  useEffect(() => {
    if (!session) return
    const { mode, visibility } = session.settings || {}
    if (mode !== 'together' || visibility !== 'live') return
    const others = Object.keys(session.players || {}).filter(p => p !== playerId)
    if (others.length === 0) return
    const unsubs = others.map(pid =>
      subscribeToLiveStrokes(code, pid, (stroke) => {
        liveRemoteStrokesRef.current[pid] = stroke
        redrawRemoteCanvas()
      })
    )
    return () => unsubs.forEach(u => u())
  }, [session, code, playerId])

  function getCanvasPoint(e, canvas) {
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches ? e.touches[0] : e
    return {
      x: (touch.clientX - rect.left) * (CANVAS_SIZE / rect.width),
      y: (touch.clientY - rect.top) * (CANVAS_SIZE / rect.height),
    }
  }

  function isPointAllowed(pt) {
    const mask = allowedMaskCanvasRef.current
    if (!mask) return true // no tear mode — drawing is always allowed
    const ctx = mask.getContext('2d')
    const pixel = ctx.getImageData(Math.floor(pt.x), Math.floor(pt.y), 1, 1).data
    return pixel[3] > 128 // opaque pixel = inside the allowed section
  }

  // Brief on-canvas toast (e.g. "Color picked").
  function flashPick(msg) {
    setPickFeedback(msg)
    if (pickTimerRef.current) clearTimeout(pickTimerRef.current)
    pickTimerRef.current = setTimeout(() => setPickFeedback(null), 1400)
  }

  // Eyedropper: sample the user's drawing layer (canvasRef, z=1) at a canvas point.
  // The outline lives on a separate layer (contourCanvasRef) so it is never sampled here.
  // Transparent/empty, white, and (defensively) near-black pixels are rejected.
  const pickColorAt = useCallback((pt) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const x = Math.floor(pt.x), y = Math.floor(pt.y)
    if (x < 0 || y < 0 || x >= CANVAS_SIZE || y >= CANVAS_SIZE) return
    const [r, g, b, a] = canvas.getContext('2d').getImageData(x, y, 1, 1).data
    if (a < 32) { flashPick('Nothing to pick here'); return }                       // empty / transparent
    if (r > 240 && g > 240 && b > 240) { flashPick('Nothing to pick here'); return } // white / blank
    if (r < 12 && g < 12 && b < 12) { flashPick('Can’t pick the outline'); return }  // near-black outline
    const hex = rgbToHex(r, g, b)
    setColor(hex)
    setRecentColors(prev => [hex, ...prev.filter(c => c !== hex)].slice(0, 8))
    setTool(prevToolRef.current || 'pencil') // return to the previous drawing tool
    flashPick('🎨 Color picked')
  }, [])

  const startDrawing = useCallback((e) => {
    if (panMode || (e.touches && e.touches.length > 1)) return
    const canvas = canvasRef.current
    if (!canvas) return
    const pt = getCanvasPoint(e, canvas)
    if (tool === 'eyedropper') { pickColorAt(pt); return }
    if (isDone) return
    if (!isPointAllowed(pt)) return
    isDrawingRef.current = true
    redoStackRef.current = []
    redoActionsRef.current = []
    const ctx = canvas.getContext('2d')
    // Snapshot now, but only commit it to history at stroke end — taps that
    // change nothing must not create empty undo steps (history and the
    // Firebase action log have to stay index-aligned).
    preStrokeSnapshotRef.current = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    currentStrokeRef.current = [pt]
    lastRenderedIndexRef.current = 0
    const sc = strokeCanvasRef.current
    if (sc) sc.getContext('2d').clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  }, [isDone, panMode, tool, pickColorAt])

  const continueDrawing = useCallback((e) => {
    if (!isDrawingRef.current || panMode || isDone || (e.touches && e.touches.length > 1)) return
    const canvas = canvasRef.current
    if (!canvas) return
    const pt = getCanvasPoint(e, canvas)
    if (!isPointAllowed(pt)) return
    const prev = currentStrokeRef.current[currentStrokeRef.current.length - 1]
    if (prev && getDistance(pt, prev) < 2) return
    currentStrokeRef.current.push(pt)
    if (tool === 'eraser') {
      const ctx = canvas.getContext('2d')
      ctx.save()
      buildClipPath(ctx)
      drawStroke(ctx, { points: currentStrokeRef.current.slice(-8), color, opacity, size, tool: 'eraser' })
      ctx.restore()
      applyAllowedMask(ctx)
    } else {
      const sc = strokeCanvasRef.current
      if (sc) {
        const sctx = sc.getContext('2d')
        const allPts = currentStrokeRef.current
        const from = Math.max(0, lastRenderedIndexRef.current - 2)
        sctx.save()
        buildClipPath(sctx)
        drawStroke(sctx, { points: allPts.slice(from), color, opacity, size, tool: 'pencil' })
        sctx.restore()
        applyAllowedMask(sctx)
        lastRenderedIndexRef.current = allPts.length
      }
    }

    const now = Date.now()
    if (now - lastProgressRef.current > 2500) {
      lastProgressRef.current = now
      calculateProgress()
    }
  }, [tool, color, opacity, size, isDone, panMode, code, playerId])

  const endDrawing = useCallback(async () => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    const pts = currentStrokeRef.current
    currentStrokeRef.current = []

    // Commit strokeCanvas to main canvas, clipped to assigned section
    const sc = strokeCanvasRef.current
    const canvas = canvasRef.current
    if (sc && canvas && tool !== 'eraser') {
      const ctx = canvas.getContext('2d')
      ctx.save()
      buildClipPath(ctx)
      ctx.drawImage(sc, 0, 0)
      ctx.restore()
      applyAllowedMask(ctx)
      sc.getContext('2d').clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    }

    clearLiveStroke(code, playerId).catch(() => {})
    // Always recalculate progress after any stroke end (draw, erase, or tap),
    // including short strokes that are not persisted to Firebase.
    calculateProgress()
    if (pts.length < 2) { preStrokeSnapshotRef.current = null; return }

    // Commit undo step + matching Firebase action in lockstep.
    const stroke = { points: pts, color, opacity, size, tool, timestamp: Date.now() }
    const action = { type: 'stroke', id: null, stroke, cancelled: false }
    if (preStrokeSnapshotRef.current) {
      historyRef.current.push(preStrokeSnapshotRef.current)
      actionsRef.current.push(action)
      if (historyRef.current.length > 10) { historyRef.current.shift(); actionsRef.current.shift() }
      preStrokeSnapshotRef.current = null
    }
    const writePromise = (async () => {
      try {
        const id = await addStroke(code, playerId, stroke)
        action.id = id
        if (action.cancelled) {
          // Undo happened before the write resolved — delete it now.
          removeStroke(code, playerId, id).catch(() => {})
        } else if (id) {
          myStrokesRef.current[id] = stroke
        }
      } catch (err) {
        console.warn('[ColorSplit] addStroke failed — stroke may be missing at reveal:', err?.message)
      }
    })()
    pendingStrokeWritesRef.current.add(writePromise)
    writePromise.finally(() => pendingStrokeWritesRef.current.delete(writePromise))
  }, [code, playerId, color, opacity, size, tool])

  function calculateProgress() {
    const canvas = canvasRef.current
    if (!canvas) return
    const data = canvas.getContext('2d').getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data
    let colored = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 10) colored++
    }
    // Tear mode: measure against the player's own section so 100% is reachable.
    const total = allowedAreaRef.current || CANVAS_SIZE * CANVAS_SIZE
    const pct = Math.min(100, Math.round((colored / total) * 100))
    setProgress(pct)
    updatePlayerProgress(code, playerId, pct).catch(() => {})
  }

  function undo() {
    const canvas = canvasRef.current
    if (!canvas || historyRef.current.length === 0) return
    const ctx = canvas.getContext('2d')
    redoStackRef.current.push(ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE))
    ctx.putImageData(historyRef.current.pop(), 0, 0)
    // Mirror to Firebase so resume + reveal don't resurrect the undone work.
    const action = actionsRef.current.pop()
    if (action) {
      redoActionsRef.current.push(action)
      if (action.type === 'stroke') {
        if (action.id) {
          delete myStrokesRef.current[action.id]
          removeStroke(code, playerId, action.id).catch(() => {})
        } else {
          action.cancelled = true // write still in flight; endDrawing cleans up
        }
      } else if (action.type === 'reset') {
        myStrokesRef.current = { ...action.strokes }
        setMyStrokes(code, playerId, action.strokes).catch(() => {})
      }
    }
    calculateProgress()
  }

  function redo() {
    const canvas = canvasRef.current
    if (!canvas || redoStackRef.current.length === 0) return
    const ctx = canvas.getContext('2d')
    historyRef.current.push(ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE))
    ctx.putImageData(redoStackRef.current.pop(), 0, 0)
    const action = redoActionsRef.current.pop()
    if (action) {
      actionsRef.current.push(action)
      if (action.type === 'stroke') {
        action.cancelled = false
        if (action.id) {
          myStrokesRef.current[action.id] = action.stroke
          setStrokeWithId(code, playerId, action.id, action.stroke).catch(() => {})
        } else {
          addStroke(code, playerId, action.stroke).then(id => {
            action.id = id
            if (id) myStrokesRef.current[id] = action.stroke
          }).catch(() => {})
        }
      } else if (action.type === 'reset') {
        myStrokesRef.current = {}
        setMyStrokes(code, playerId, null).catch(() => {})
      }
    }
    calculateProgress()
  }

  function resetCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    historyRef.current.push(ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE))
    // Keep the removed strokes in the action so undo can restore them.
    actionsRef.current.push({ type: 'reset', strokes: { ...myStrokesRef.current } })
    if (historyRef.current.length > 10) { historyRef.current.shift(); actionsRef.current.shift() }
    redoStackRef.current = []
    redoActionsRef.current = []
    myStrokesRef.current = {}
    setMyStrokes(code, playerId, null).catch(() => {})
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    calculateProgress()
  }

  // Touch handlers (pan/zoom)
  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      // A second finger / palm landed mid-stroke. Commit whatever was drawn so
      // far instead of discarding it — otherwise the in-progress stroke (which
      // only lives on the preview layer) is lost when the next stroke clears it.
      if (isDrawingRef.current) endDrawing()
      isDrawingRef.current = false
      const t1 = e.touches[0], t2 = e.touches[1]
      lastPanRef.current = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 }
      lastPinchDistRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      isPanningRef.current = true
      gesturePinchedRef.current = true
    } else if (panMode) {
      // 1-finger pan in Move mode
      isPanningRef.current = true
      lastPanRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else {
      isPanningRef.current = false
      startDrawing(e)
    }
  }

  // Keep the artwork on-screen: allow panning only as far as the zoom-induced
  // overflow plus a small margin, so the canvas can never be lost off-screen.
  // Reads zoom/containerSize via refs so the no-dep wheel handler stays correct.
  function clampPan(p) {
    const cs = containerSizeRef.current || 375
    const overflow = Math.max(0, (cs * zoomRef.current - cs) / 2)
    const max = overflow + cs * 0.35
    return { x: Math.max(-max, Math.min(max, p.x)), y: Math.max(-max, Math.min(max, p.y)) }
  }

  function handleTouchMove(e) {
    e.preventDefault()
    if (e.touches.length === 2 && isPanningRef.current) {
      // Two-finger gesture: pinch-to-zoom + pan together (always available).
      const t1 = e.touches[0], t2 = e.touches[1]
      const midX = (t1.clientX + t2.clientX) / 2
      const midY = (t1.clientY + t2.clientY) / 2
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      const panDX = lastPanRef.current ? midX - lastPanRef.current.x : 0
      const panDY = lastPanRef.current ? midY - lastPanRef.current.y : 0
      const prevDist = lastPinchDistRef.current
      if (prevDist) {
        const rect = containerRef.current.getBoundingClientRect()
        const cx = midX - rect.left - rect.width / 2
        const cy = midY - rect.top - rect.height / 2
        const factor = dist / prevDist
        setZoom(prevZoom => {
          const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prevZoom * factor))
          if (newZoom <= 1) setPan({ x: 0, y: 0 })
          const ratio = newZoom / prevZoom
          setPan(p => clampPan({
            x: cx * (1 - ratio) + p.x * ratio + panDX,
            y: cy * (1 - ratio) + p.y * ratio + panDY,
          }))
          return newZoom
        })
      } else if (lastPanRef.current) {
        setPan(p => clampPan({ x: p.x + panDX, y: p.y + panDY }))
      }
      lastPanRef.current = { x: midX, y: midY }
      lastPinchDistRef.current = dist
    } else if (e.touches.length === 1 && panMode && isPanningRef.current) {
      // 1-finger pan in Move mode
      const dx = e.touches[0].clientX - lastPanRef.current.x
      const dy = e.touches[0].clientY - lastPanRef.current.y
      setPan(p => clampPan({ x: p.x + dx, y: p.y + dy }))
      lastPanRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if (e.touches.length === 1 && !panMode) {
      continueDrawing(e)
    }
  }

  function handleTouchEnd(e) {
    if (e.touches.length === 0) {
      const wasPinch = gesturePinchedRef.current
      const drew = currentStrokeRef.current.length > 1
      isPanningRef.current = false
      lastPinchDistRef.current = null
      lastPanRef.current = null
      gesturePinchedRef.current = false
      if (!panMode) endDrawing()
      // Double-tap to reset zoom — only for a clean tap (no pinch, no drawing,
      // not in Move mode, not picking a color).
      if (!wasPinch && !drew && !panMode && tool !== 'eyedropper') {
        const now = Date.now()
        if (now - lastTapRef.current < 300) {
          setZoom(1); setPan({ x: 0, y: 0 })
          lastTapRef.current = 0
        } else {
          lastTapRef.current = now
        }
      }
    } else if (e.touches.length === 2) {
      // Dropped from 3→2 fingers — re-seat pinch/pan references.
      const t1 = e.touches[0], t2 = e.touches[1]
      lastPanRef.current = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 }
      lastPinchDistRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
    } else if (e.touches.length === 1 && panMode && isPanningRef.current) {
      // Transition from 2-finger pan to 1-finger pan — update reference point
      lastPanRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if (e.touches.length === 1 && isPanningRef.current) {
      // 2→1 finger while drawing mode: stop the pinch cleanly, don't start a stroke.
      isPanningRef.current = false
      lastPinchDistRef.current = null
    }
  }

  // Scroll-to-zoom (trackpad pinch = ctrlKey, trackpad scroll = pan, mouse scroll = zoom)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e) => {
      e.preventDefault()

      const rect = el.getBoundingClientRect()
      // Cursor position relative to container centre
      const cx = e.clientX - rect.left - rect.width / 2
      const cy = e.clientY - rect.top - rect.height / 2

      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch gesture — zoom towards cursor
        const normalized = e.deltaMode === 0 ? e.deltaY : e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY * 500
        const factor = Math.exp(-normalized * 0.006)
        setZoom(prevZoom => {
          const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prevZoom * factor))
          if (newZoom <= 1) setPan({ x: 0, y: 0 })
          const ratio = newZoom / prevZoom
          setPan(p => clampPan({
            x: cx * (1 - ratio) + p.x * ratio,
            y: cy * (1 - ratio) + p.y * ratio,
          }))
          return newZoom
        })
      } else if (e.shiftKey) {
        // Shift+scroll = zoom (useful for mouse users without Ctrl)
        const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1
        setZoom(prevZoom => {
          const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prevZoom * factor))
          if (newZoom <= 1) setPan({ x: 0, y: 0 })
          const ratio = newZoom / prevZoom
          setPan(p => clampPan({
            x: cx * (1 - ratio) + p.x * ratio,
            y: cy * (1 - ratio) + p.y * ratio,
          }))
          return newZoom
        })
      } else if (panModeRef.current) {
        // Plain scroll pans only when Move mode is active
        setPan(p => clampPan({
          x: p.x - e.deltaX,
          y: p.y - e.deltaY,
        }))
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, []) // no deps needed — all state access uses updater functions

  // Block all browser-default touch behaviour inside the canvas container.
  // React's synthetic onTouch* are passive in React 17+, so preventDefault() there is a no-op.
  // Native non-passive listeners are required to reliably stop iOS Safari scroll/zoom.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const prevent = (e) => e.preventDefault()
    el.addEventListener('touchstart', prevent, { passive: false })
    el.addEventListener('touchmove', prevent, { passive: false })
    document.addEventListener('gesturestart', prevent, { passive: false })
    document.addEventListener('gesturechange', prevent, { passive: false })
    return () => {
      el.removeEventListener('touchstart', prevent)
      el.removeEventListener('touchmove', prevent)
      document.removeEventListener('gesturestart', prevent)
      document.removeEventListener('gesturechange', prevent)
    }
  }, [])

  // Safari/WebKit discards canvas GPU backing stores when a tab is backgrounded.
  // The React component stays mounted, so the mount-time stroke restore does not
  // re-run. On resume, replay all committed strokes from the in-memory mirror so
  // white spots caused by partial canvas clearing are immediately healed.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      // A touch interrupted by a system event (phone call, notification) may leave
      // isDrawingRef stuck at true — reset it so recovery isn't blocked forever.
      isDrawingRef.current = false
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      Object.values(myStrokesRef.current)
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        .forEach(stroke => { if (stroke?.points?.length) drawStroke(ctx, stroke) })
      applyAllowedMask(ctx)
      calculateProgress()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, []) // all access through stable refs — no deps needed

  function resetView() {
    const el = containerRef.current
    if (!el) { setZoom(1); setPan({ x: 0, y: 0 }); return }
    const { width, height } = el.getBoundingClientRect()
    // True contain-fit: the canvas CSS size is containerSize × containerSize.
    // Zoom so the full canvas is visible within both dimensions (no cropping).
    const css = containerSize > 0 ? containerSize : Math.min(width, height)
    const fitZoom = Math.max(0.5, Math.min(width / css, height / css, 1.5))
    setZoom(fitZoom)
    setPan({ x: 0, y: 0 })
  }

  // Create a transparent PNG snapshot from the player's color canvas (no line art, no white fill).
  // Transparent pixels survive the destination-in composite in RevealScreen, letting both
  // players' sections tile correctly with no white gaps at the seam.
  function captureColorSnapshot() {
    const colorCanvas = canvasRef.current
    if (!colorCanvas) return null
    try {
      const snap = document.createElement('canvas')
      snap.width = CANVAS_SIZE
      snap.height = CANVAS_SIZE
      const ctx = snap.getContext('2d')
      ctx.drawImage(colorCanvas, 0, 0)
      // Preview stroke on top — clear after Done tap so this is normally a no-op.
      const sc = strokeCanvasRef.current
      if (sc) ctx.drawImage(sc, 0, 0)
      return snap.toDataURL('image/png')
    } catch {
      return null
    }
  }

  // Save merged canvas for reveal
  function saveCanvasForReveal() {
    const colorCanvas = canvasRef.current
    const contourCanvas = contourCanvasRef.current
    if (!colorCanvas) return
    try {
      const merge = document.createElement('canvas')
      merge.width = CANVAS_SIZE
      merge.height = CANVAS_SIZE
      const ctx = merge.getContext('2d')
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      ctx.drawImage(colorCanvas, 0, 0)
      if (contourCanvas) {
        ctx.globalCompositeOperation = 'multiply'
        ctx.drawImage(contourCanvas, 0, 0)
      }
      const dataUrl = merge.toDataURL('image/png')
      const mySection = session?.players?.[playerId]?.assignedSection || 'full'
      sessionStorage.setItem(`colorsplit_canvas_${code}_${mySection}`, dataUrl)
      sessionStorage.setItem(`colorsplit_canvas_${code}_latest`, dataUrl)
    } catch (e) {}
  }

  async function handleDone() {
    saveCanvasForReveal()
    setIsDone(true)
    setShowDoneConfirm(false)
    // Upload color canvas snapshot to Firebase Storage for reveal (solo + tear mode).
    if (session?.settings?.mode === 'tear' || session?.settings?.mode === 'solo') {
      setDonePhase('uploading')
      try {
        const dataUrl = captureColorSnapshot()
        if (dataUrl) {
          try { sessionStorage.setItem(`colorsplit_transparent_snapshot_${code}_${playerId}`, dataUrl) } catch {}
          let url
          try {
            url = await uploadPlayerSnapshot(code, playerId, dataUrl)
          } catch {
            // First attempt failed — retry once after 1.5s.
            await new Promise(r => setTimeout(r, 1500))
            url = await uploadPlayerSnapshot(code, playerId, dataUrl)
          }
          await setPlayerSnapshotUrl(code, playerId, url)
        }
      } catch (err) {
        console.warn('[ColorSplit] Snapshot upload failed after retry — sessionStorage fallback available for reveal:', err?.message)
      }
    }
    setDonePhase('waiting')
    // Flush in-flight stroke writes before marking done in Firebase so
    // getAllStrokes on the reveal screen sees the complete set of strokes.
    const pendingWrites = [...pendingStrokeWritesRef.current]
    if (pendingWrites.length > 0) {
      const timeout = new Promise(resolve => setTimeout(resolve, 6000))
      await Promise.race([Promise.allSettled(pendingWrites), timeout])
    }
    try {
      await setPlayerDone(code, playerId, true)
      // Navigation to reveal is handled by the subscription when all players are done
    } catch {
      navigate(`/session/${code}/reveal`)
    }
  }

  async function handleLeaveConfirm() {
    isLeavingRef.current = true
    setShowLeaveModal(false)
    try { await leaveRoom(code, playerId) } catch {}
    navigate('/', { replace: true })
  }

  panModeRef.current = panMode
  zoomRef.current = zoom
  containerSizeRef.current = containerSize

  function handleSizeChange(s) {
    if (tool === 'eraser') setEraserSize(s)
    else setPencilSize(s)
  }

  function handleToolChange(t) {
    // Remember the drawing tool so an eyedropper pick can restore it afterwards.
    if (t === 'eyedropper' && (tool === 'pencil' || tool === 'eraser')) prevToolRef.current = tool
    setTool(t)
    setPanMode(false)
  }

  function selectColor(c) {
    setColor(c)
    setRecentColors(prev => [c, ...prev.filter(x => x !== c)].slice(0, 8))
    setPanMode(false)
    setTool('pencil')
  }

  const mySection = session?.players?.[playerId]?.assignedSection
  const mode = session?.settings?.mode
  const visibility = session?.settings?.visibility
  const isSolo = session?.settings?.mode === 'solo'
  const effectiveSoloPalette = isSolo ? soloPalette : null

  const tearOrientation = session?.tearLine?.orientation ?? 'horizontal'

  // Combined progress: average across all active players (works for solo too).
  const activePartners = Object.values(otherProgress).filter(p => !p.left)
  const combinedProgress = Math.min(100, Math.round(
    [progress, ...activePartners.map(p => p.progress || 0)]
      .reduce((a, b) => a + b, 0) / (1 + activePartners.length)
  ))
  const partnerProgressLabel = activePartners
    .map(p => ` · ${(p.name || 'Friend').split(' ')[0]} ${p.progress || 0}%`)
    .join('')

  // Partners who dropped (presence flag flipped by Firebase onDisconnect).
  // `connected === undefined` means presence was never set up — treat as online.
  const reconnectingNames = Object.values(otherProgress)
    .filter(p => p.connected === false && !p.left && !p.done)
    .map(p => p.name || 'Your friend')

  // CSS clip-path for piece-only view in tear mode (purely visual).
  const pieceClipPath = (() => {
    const tp = session?.tearLine?.points
    if (mode !== 'tear' || !mySection || !tp?.length) return undefined
    const last = tp.length - 1
    const pct = (x, y) => `${(x / 4).toFixed(2)}% ${(y / 4).toFixed(2)}%`
    const isZone0 = normalizeSection(mySection) === 'zone0'
    if (tearOrientation === 'vertical') {
      if (isZone0) {
        // Left of vertical line: TL → tear forward → BL
        const forward = tp.map(p => pct(p.x, p.y)).join(', ')
        return `polygon(0% 0%, ${forward}, 0% 100%)`
      } else {
        // Right of vertical line: TR → BR → tear backward
        const reversed = [...tp].reverse().map(p => pct(p.x, p.y)).join(', ')
        return `polygon(100% 0%, 100% 100%, ${reversed})`
      }
    }
    // horizontal
    if (isZone0) {
      const reversed = [...tp].reverse().map(p => pct(p.x, p.y)).join(', ')
      return `polygon(0% 0%, 100% 0%, 100% ${(tp[last].y / 4).toFixed(2)}%, ${reversed}, 0% ${(tp[0].y / 4).toFixed(2)}%)`
    } else {
      const forward = tp.map(p => pct(p.x, p.y)).join(', ')
      return `polygon(0% ${(tp[0].y / 4).toFixed(2)}%, ${forward}, 100% ${(tp[last].y / 4).toFixed(2)}%, 100% 100%, 0% 100%)`
    }
  })()

  // Loading: session not yet received from Firebase
  if (!session) {
    return (
      <div className="h-dvh bg-[#1a1a1a] flex items-center justify-center">
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.4 }} className="text-5xl">🎨</motion.div>
      </div>
    )
  }

  return (
    <div
      className="bg-[#1a1a1a] flex flex-col overflow-hidden"
      style={{ position: 'fixed', inset: 0, touchAction: 'none', overscrollBehavior: 'none' }}
    >
      {/* Top bar */}
      <div
        className="bg-cream/95 backdrop-blur-sm flex items-center gap-2 py-2 border-b border-ink/10 flex-shrink-0"
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isSolo && (
            <button
              onClick={() => setShowLeaveModal(true)}
              style={{ touchAction: 'manipulation' }}
              className="bg-white text-ink font-body text-base leading-none rounded-full w-9 h-9 flex items-center justify-center shadow-sm border border-ink/10 active:scale-95 flex-shrink-0"
              title="Leave room"
            >←</button>
          )}
          <div className="flex flex-col leading-none">
            {mode === 'tear' && mySection ? (
              <span className="font-display text-base text-ink" style={{ fontFamily: "'Fredoka One', cursive" }}>
                {tearOrientation === 'vertical'
                  ? (normalizeSection(mySection) === 'zone0' ? '◀ Left' : '▶ Right')
                  : (normalizeSection(mySection) === 'zone0' ? '▲ Top' : '▼ Bottom')}
              </span>
            ) : (
              <img
                src="/icons/colorsplit-icon-mini.png"
                alt="ColorSplit"
                className="w-12 h-12 select-none"
                draggable="false"
              />
            )}
            {!isSolo && (
              <span className="font-mono text-[9px] font-bold text-ink/35 tracking-widest mt-0.5">{code}</span>
            )}
          </div>
        </div>
        {effectiveSoloPalette && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {effectiveSoloPalette.map(c => (
              <button
                key={c}
                onClick={() => selectColor(c)}
                className={`rounded-full transition-all ${color === c ? 'ring-2 ring-offset-1 ring-blue-500 scale-125' : 'opacity-70'}`}
                style={{ width: 14, height: 14, background: c, flexShrink: 0 }}
              />
            ))}
          </div>
        )}
        {/* Progress — soft white card, readable on any background.
            Row 1: bar + combined %. Row 2: the fun phrase (its own line, never
            truncated away). Row 3 (multiplayer): per-player breakdown. */}
        <div className="flex items-center flex-1 justify-center min-w-0 px-1.5">
          <div
            className="flex flex-col items-center gap-0.5 min-w-0 w-full max-w-[240px] bg-white rounded-2xl px-4 py-1 border border-ink/10"
            style={{ boxShadow: '0 4px 12px rgba(45,36,22,0.14)' }}
          >
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 h-[8px] bg-blue-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${combinedProgress}%`, background: 'linear-gradient(90deg, #8b5cf6 0%, #3b82f6 100%)' }}
                />
              </div>
              <span className="text-[13px] font-bold font-body text-ink flex-shrink-0 leading-none">
                {combinedProgress}%
              </span>
            </div>
            {/* Fun phrase — the star, full contrast, always visible */}
            <span className="hidden sm:block text-[12px] font-bold font-body text-violet-600 truncate w-full text-center leading-tight">
              {progressPhrase(combinedProgress, isSolo)}
            </span>
            {/* Per-player chips (multiplayer only) — scrollable for 3–4 players */}
            {!isSolo && (() => {
              const myColorHex = AVATAR_COLORS.find(c => c.id === session?.players?.[playerId]?.colorId)?.hex || '#E0D4FF'
              return (
                <div className="flex flex-wrap gap-1 w-full justify-center">
                  <span
                    className="flex-shrink-0 text-[10px] font-semibold font-body text-ink/70 px-2 py-0.5 rounded-full leading-none"
                    style={{ background: myColorHex }}
                  >
                    You {isDone ? '✓' : `${progress}%`}
                  </span>
                  {activePartners.map((p, i) => {
                    const hex = AVATAR_COLORS.find(c => c.id === p.colorId)?.hex || '#C8F0DC'
                    return (
                      <span
                        key={i}
                        className="flex-shrink-0 text-[10px] font-semibold font-body text-ink/70 px-2 py-0.5 rounded-full leading-none"
                        style={{ background: hex }}
                      >
                        {(p.name || 'Friend').split(' ')[0]} {p.done ? '✓' : `${p.progress || 0}%`}
                      </span>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        </div>
        <button
          onClick={() => setShowDoneConfirm(true)}
          disabled={isDone}
          style={{ touchAction: 'manipulation', flexShrink: 0, background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)' }}
          className="text-white text-sm font-semibold px-4 py-2 rounded-xl active:scale-95 transition-all disabled:opacity-40 font-body"
        >
          {isDone ? 'Done ✓' : 'Done'}
        </button>
      </div>

      {/* Partner banners are rendered as overlays INSIDE the canvas container
          (below) so they float over the canvas instead of pushing it down —
          otherwise the partner's state changes (connection flap, done) would
          shift the whole canvas and make it look like it "moves" on its own. */}

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 flex items-center justify-center overflow-hidden relative"
        style={{ touchAction: 'none', zIndex: 1, isolation: 'isolate', background: 'radial-gradient(circle at center, #2a2a2a 0%, #1f1f1f 45%, #151515 100%)' }}
      >
        {/* Partner status banners — absolute overlay, never affects canvas layout */}
        <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none flex flex-col gap-1 p-2">
          {leftPlayerNames.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50/95 backdrop-blur-sm border border-orange-200 shadow-sm">
              <span className="text-orange-500 text-sm">👋</span>
              <span className="font-body text-orange-800 text-xs font-semibold">
                {leftPlayerNames.join(' & ')} left the session — your work is safe.
                Keep coloring and tap Done to finish without them.
              </span>
            </div>
          )}
          {reconnectingNames.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50/95 backdrop-blur-sm border border-blue-200 shadow-sm">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.6, ease: 'linear' }}
                className="text-blue-500 text-sm inline-block"
              >🔄</motion.span>
              <span className="font-body text-blue-800 text-xs font-semibold">
                {reconnectingNames.join(' & ')} lost connection — your artwork is safe, waiting for them to come back…
              </span>
            </div>
          )}
          <AnimatePresence>
            {partnerDoneToast && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cream/95 backdrop-blur-sm border border-ink/10 shadow-md self-center mx-auto"
                style={{ pointerEvents: 'none' }}
              >
                {partnerDoneToast.colorHex && (
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-ink/15" style={{ background: partnerDoneToast.colorHex }} />
                )}
                <span className="font-body text-ink text-xs font-semibold">{partnerDoneToast.message}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            willChange: 'transform',
            position: 'relative',
            width: containerSize,
            height: containerSize,
            flexShrink: 0,
            clipPath: pieceClipPath, // piece-only view: hides the other player's section visually
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.45)',
          }}
        >
          <div className="absolute inset-0 bg-white" style={{ zIndex: 0 }} />
          {/* Local committed strokes — receives all draw events; layers above have pointerEvents:none */}
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1, cursor: panMode ? 'grab' : (tool === 'eyedropper' ? 'copy' : (tool === 'eraser' ? 'cell' : 'crosshair')), touchAction: 'none' }}
            onMouseDown={e => {
              if (panMode) { mousePanRef.current = { x: e.clientX, y: e.clientY } }
              else startDrawing(e)
            }}
            onMouseMove={e => {
              if (panMode) {
                if (!mousePanRef.current) return
                const dx = e.clientX - mousePanRef.current.x
                const dy = e.clientY - mousePanRef.current.y
                setPan(p => clampPan({ x: p.x + dx, y: p.y + dy }))
                mousePanRef.current = { x: e.clientX, y: e.clientY }
              } else {
                continueDrawing(e)
              }
            }}
            onMouseUp={() => { mousePanRef.current = null; if (!panMode) endDrawing() }}
            onMouseLeave={() => { mousePanRef.current = null; if (!panMode) endDrawing() }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          />
          {/* Local in-progress stroke preview (pencil only) */}
          <canvas
            ref={strokeCanvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }}
          />
          {/* Remote players' color layer */}
          <canvas
            ref={remoteCanvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 3, pointerEvents: 'none' }}
          />
          {/* Contour overlay */}
          <canvas
            ref={contourCanvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 5, mixBlendMode: 'multiply', pointerEvents: 'none' }}
          />
          {/* Tear section mask */}
          <canvas
            ref={maskCanvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 6, pointerEvents: 'none' }}
          />
        </div>

        {/* Zoom controls — always visible, z-index above canvas */}
        <div className="absolute flex flex-col gap-1.5" style={{ zIndex: 20, bottom: '1rem', right: 'max(1rem, env(safe-area-inset-right, 0px))' }}>
          <button
            onClick={() => setPanMode(v => !v)}
            className={`w-10 h-10 rounded-xl shadow-lg active:scale-90 transition-transform font-body text-lg leading-none flex items-center justify-center border ${
              panMode ? 'bg-blue-500 text-white border-blue-400' : 'bg-white/95 backdrop-blur-sm text-ink/70 border-white/60'
            }`}
            style={{ touchAction: 'manipulation' }}
            title="Move canvas"
          >✋</button>
          <button
            onClick={() => setZoom(z => Math.min(MAX_ZOOM, Math.round((z + 0.25) * 100) / 100))}
            className="bg-white/95 backdrop-blur-sm border border-white/60 text-ink/70 font-bold w-10 h-10 rounded-xl shadow-lg active:scale-90 transition-transform font-body text-xl leading-none flex items-center justify-center"
            style={{ touchAction: 'manipulation' }}
          >+</button>
          <button
            onClick={() => {
              const newZ = Math.max(MIN_ZOOM, Math.round((zoom - 0.25) * 100) / 100)
              setZoom(newZ)
              if (newZ <= 1) setPan({ x: 0, y: 0 })
            }}
            className="bg-white/95 backdrop-blur-sm border border-white/60 text-ink/70 font-bold w-10 h-10 rounded-xl shadow-lg active:scale-90 transition-transform font-body text-xl leading-none flex items-center justify-center"
            style={{ touchAction: 'manipulation' }}
          >−</button>
          <button
            onClick={resetView}
            className="bg-white/95 backdrop-blur-sm border border-white/60 text-ink/70 text-xs font-semibold w-10 h-10 rounded-xl shadow-lg active:scale-90 transition-transform font-body leading-none flex items-center justify-center"
            style={{ touchAction: 'manipulation' }}
          >Fit</button>
        </div>

        {/* Eyedropper feedback toast */}
        <AnimatePresence>
          {pickFeedback && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex items-center gap-2 bg-ink/85 backdrop-blur-sm text-white px-4 py-2 rounded-full font-body text-sm shadow-lg"
            >
              <span className="w-4 h-4 rounded-full border border-white/60 inline-block flex-shrink-0" style={{ background: color }} />
              {pickFeedback}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toolbar */}
      <div style={{ position: 'relative', zIndex: 10, flexShrink: 0 }}>
      <Toolbar
        tool={tool} onToolChange={handleToolChange}
        size={size} onSizeChange={handleSizeChange}
        color={color} recentColors={recentColors}
        onColorClick={effectiveSoloPalette ? null : () => setShowColorPicker(true)}
        onSelectRecentColor={selectColor}
        onUndo={undo} onRedo={redo} onReset={resetCanvas}
      />
      </div>

      {/* Color picker */}
      <AnimatePresence>
        {showColorPicker && (
          <ColorPicker
            currentColor={color}
            opacity={opacity}
            onColorChange={setColor}
            onColorCommit={selectColor}
            onOpacityChange={setOpacity}
            onClose={() => setShowColorPicker(false)}
          />
        )}
      </AnimatePresence>

      {/* Leave room modal — confirmation only. A partner leaving never blocks
          this player anymore; it shows the banner overlay instead. */}
      <LeaveRoomModal
        showConfirm={showLeaveModal}
        onCancel={() => setShowLeaveModal(false)}
        onConfirm={handleLeaveConfirm}
        abandonedByName={null}
        onGoHome={() => { isLeavingRef.current = true; navigate('/', { replace: true }) }}
        title="Leave this artwork?"
        subtitle="Your strokes stay in the artwork. The others can keep coloring and finish without you."
      />

      {/* Done confirmation */}
      <AnimatePresence>
        {showDoneConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/60 backdrop-blur-sm flex items-end justify-center z-50"
            onClick={() => setShowDoneConfirm(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              onClick={e => e.stopPropagation()}
              className="bg-cream w-full max-w-lg rounded-t-3xl p-6"
              style={{ paddingBottom: 'max(2.5rem, env(safe-area-inset-bottom))' }}
            >
              <h2 className="font-display text-2xl text-ink mb-2 text-center" style={{ fontFamily: "'Fredoka One', cursive" }}>
                Done coloring?
              </h2>
              <p className="text-ink/50 font-body text-center mb-6 text-sm">
                You won't be able to color anymore. Once everyone is done, the reveal starts!
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowDoneConfirm(false)} className="flex-1 bg-white text-ink font-semibold py-4 rounded-2xl border border-ink/10 font-body active:scale-95 transition-transform">
                  Keep coloring
                </button>
                <button onClick={handleDone} className="flex-1 bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lifted font-body active:scale-95 transition-transform">
                  I'm done! 🎨
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isDone && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-ink/80 backdrop-blur-sm text-white px-5 py-3 rounded-2xl font-body text-sm flex items-center gap-2"
        >
          {donePhase === 'uploading' ? (
            <>
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                className="inline-block"
              >⏳</motion.span>
              Saving your artwork…
            </>
          ) : (
            <>Waiting for others…</>
          )}
        </motion.div>
      )}
    </div>
  )
}
