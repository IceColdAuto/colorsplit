import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { setTearLine, updateSessionStatus, assignSections, getOrCreatePlayerId, subscribeToSession, leaveRoom } from '../lib/session'
import RoomStatusBar from '../components/RoomStatusBar'
import LeaveRoomModal from '../components/LeaveRoomModal'

// Returns { points, orientation: 'horizontal' | 'vertical' }.
// Randomly picks horizontal or vertical with equal probability.
// Horizontal: points go left→right (x: 0→400), y varies — sections are top / bottom.
// Vertical:   points go top→bottom (y: 0→400), x varies — sections are left / right.
function generateTearLine(width = 400, height = 400) {
  const isVertical = Math.random() < 0.5

  function makeLine(primary, secondary, segments, axis) {
    // axis 'x': primary coord increases 0→width, secondary (y) varies
    // axis 'y': primary coord increases 0→height, secondary (x) varies
    const total = axis === 'x' ? width : height
    const limit = axis === 'x' ? height : width
    const points = []
    let sec = primary  // secondary value tracks jitter
    for (let i = 0; i <= segments; i++) {
      const pri = Math.round((total * i) / segments)
      if (i > 0) {
        const progress = i / segments
        const target = primary + (secondary - primary) * progress
        const jitter = (Math.random() - 0.5) * 30
        sec = sec * 0.65 + target * 0.35 + jitter
        sec = Math.max(limit * 0.06, Math.min(limit * 0.94, sec))
      }
      points.push(axis === 'x' ? { x: pri, y: Math.round(sec) } : { x: Math.round(sec), y: pri })
    }
    return points
  }

  function pickEndpoints(lo, hi, range) {
    const style = Math.floor(Math.random() * 5)
    let a, b
    switch (style) {
      case 0: a = lo + range * (0.38 + Math.random() * 0.24); b = lo + range * (0.38 + Math.random() * 0.24); break
      case 1: a = lo + range * (0.55 + Math.random() * 0.20); b = lo + range * (0.25 + Math.random() * 0.20); break
      case 2: a = lo + range * (0.25 + Math.random() * 0.20); b = lo + range * (0.55 + Math.random() * 0.20); break
      case 3: a = lo + range * (0.65 + Math.random() * 0.15); b = lo + range * (0.10 + Math.random() * 0.15); break
      default:a = lo + range * (0.10 + Math.random() * 0.15); b = lo + range * (0.65 + Math.random() * 0.15); break
    }
    // Clamp average to 40–60 % of range for fairness
    const avg = (a + b) / 2
    const minV = lo + range * 0.40, maxV = lo + range * 0.60
    const shift = avg < minV ? minV - avg : avg > maxV ? maxV - avg : 0
    a = Math.max(lo + range * 0.08, Math.min(lo + range * 0.92, a + shift))
    b = Math.max(lo + range * 0.08, Math.min(lo + range * 0.92, b + shift))
    return [a, b]
  }

  if (isVertical) {
    const [startX, endX] = pickEndpoints(0, 1, width)
    const points = makeLine(startX, endX, 26, 'y')
    return { points, orientation: 'vertical' }
  } else {
    const [startY, endY] = pickEndpoints(0, 1, height)
    const points = makeLine(startY, endY, 26, 'x')
    return { points, orientation: 'horizontal' }
  }
}

// orientation: 'horizontal' → split top/bottom; 'vertical' → split left/right.
// split.top = section-A %, split.bottom = section-B % (abstract, orientation-dependent).
function calculateSplit(points, orientation = 'horizontal', width = 400, height = 400) {
  if (orientation === 'vertical') {
    // Area LEFT of the tear: sum of horizontal strips Δy × avg_x
    let areaLeft = 0
    for (let i = 0; i < points.length - 1; i++) {
      areaLeft += (points[i + 1].y - points[i].y) * (points[i].x + points[i + 1].x) / 2
    }
    const pct = Math.round((areaLeft / (width * height)) * 100)
    return { top: pct, bottom: 100 - pct }
  }
  // Horizontal: area BELOW the tear
  let areaBelow = 0
  for (let i = 0; i < points.length - 1; i++) {
    areaBelow += (points[i + 1].x - points[i].x) * (height - (points[i].y + points[i + 1].y) / 2)
  }
  const pct = Math.round((areaBelow / (width * height)) * 100)
  return { top: 100 - pct, bottom: pct }
}

function TearPath({ points, size = 300 }) {
  if (!points?.length) return null
  const scale = size / 400
  const d = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${Math.round(p.x * scale)},${Math.round(p.y * scale)}`
  ).join(' ')
  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }} width={size} height={size}>
      <path d={d} stroke="#2D2416" strokeWidth="2.5" fill="none" strokeDasharray="7,5" strokeLinecap="round" />
    </svg>
  )
}

export default function TearScreen() {
  const { code } = useParams()
  const navigate = useNavigate()
  const playerId = getOrCreatePlayerId()
  const [session, setSession] = useState(null)
  const [tearPoints, setTearPoints] = useState(null)
  const [tearOrientation, setTearOrientation] = useState('horizontal')
  const [split, setSplit] = useState(null)
  const [isTearing, setIsTearing] = useState(false)
  const [tooSkewed, setTooSkewed] = useState(false)
  const [tearing, setTearing] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [abandonedByName, setAbandonedByName] = useState(null)
  const containerRef = useRef(null)
  const touchStartRef = useRef(null)
  const isLeavingRef = useRef(false)

  useEffect(() => {
    const unsub = subscribeToSession(code, (data) => {
      if (isLeavingRef.current || !data) return
      // Block only when NO other active player remains (tear needs a partner).
      // In a 3-4 player room one person leaving must not end it for the rest.
      const others = Object.entries(data.players || {}).filter(([pid]) => pid !== playerId)
      const othersActive = others.filter(([, p]) => p.name && !p.left)
      const othersLeft = others.filter(([, p]) => p.left)
      if (othersLeft.length > 0 && othersActive.length === 0) {
        setAbandonedByName(othersLeft[0][1].name || 'The other player'); return
      }
      setSession(data)
      if (data.tearLine) {
        const orient = data.tearLine.orientation || 'horizontal'
        setTearPoints(data.tearLine.points)
        setTearOrientation(orient)
        setSplit(calculateSplit(data.tearLine.points, orient))
      }
      if (data.status === 'ready_check') navigate(`/session/${code}/ready`)
    })
    return unsub
  }, [code])

  async function handleLeaveConfirm() {
    isLeavingRef.current = true
    setShowLeaveModal(false)
    try { await leaveRoom(code, playerId) } catch {}
    navigate('/', { replace: true })
  }

  const controllerId = session?.roundControllerId || session?.hostId
  const isController = controllerId === playerId
  const controllerName = session?.players?.[controllerId]?.name || 'Other player'

  function newTear() {
    let result, s
    do {
      result = generateTearLine()
      s = calculateSplit(result.points, result.orientation)
    } while (s.top < 40 || s.bottom < 40)
    setTearPoints(result.points)
    setTearOrientation(result.orientation)
    setSplit(s)
    setTooSkewed(false)
  }

  useEffect(() => { if (!tearPoints) newTear() }, [])

  // Manual tear via swipe
  const handleTouchStart = useCallback((e) => {
    if (!isController) return
    setIsTearing(true)
    setTearOrientation('horizontal') // manual swipe always produces a horizontal tear
    const rect = containerRef.current.getBoundingClientRect()
    const t = e.touches[0]
    const startX = t.clientX - rect.left
    const startY = t.clientY - rect.top
    touchStartRef.current = {
      startTime: Date.now(),
      rect,
      points: [{ x: startX, y: startY }],
    }
  }, [isController])

  const handleTouchMove = useCallback((e) => {
    if (!isTearing || !touchStartRef.current) return
    e.preventDefault()
    const { rect, startTime, points } = touchStartRef.current
    const t = e.touches[0]
    const x = t.clientX - rect.left
    const y = t.clientY - rect.top
    const elapsed = (Date.now() - startTime) / 300
    const jitter = (Math.random() - 0.5) * Math.min(elapsed, 1) * 28
    const scaleX = 400 / rect.width
    const scaleY = 400 / rect.height
    const newPt = {
      x: Math.round(Math.max(0, Math.min(400, x * scaleX))),
      y: Math.round(Math.max(8, Math.min(392, y * scaleY + jitter))),
    }
    const next = [...points, newPt]
    touchStartRef.current.points = next
    setTearPoints(next)
    setSplit(calculateSplit(next, 'horizontal'))
  }, [isTearing])

  const handleTouchEnd = useCallback(() => {
    setIsTearing(false)
    if (touchStartRef.current?.points?.length < 3) return
    const s = calculateSplit(touchStartRef.current.points, 'horizontal')
    if (s.top < 40 || s.bottom < 40) setTooSkewed(true)
  }, [])

  async function handleConfirm() {
    const s = calculateSplit(tearPoints, tearOrientation)
    if (s.top < 40 || s.bottom < 40) { setTooSkewed(true); return }

    setTearing(true)

    // Tear sound — quieter, longer
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const sampleRate = ctx.sampleRate
      const duration = 0.6
      const buf = ctx.createBuffer(1, sampleRate * duration, sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) {
        const env = Math.exp(-i / (sampleRate * 0.15))
        data[i] = (Math.random() * 2 - 1) * env
      }
      const src = ctx.createBufferSource()
      src.buffer = buf
      const gain = ctx.createGain()
      gain.gain.value = 0.05          // much quieter
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 1600
      filter.Q.value = 0.4
      src.connect(filter)
      filter.connect(gain)
      gain.connect(ctx.destination)
      src.start()
    } catch {}

    try {
      await setTearLine(code, { points: tearPoints, split: s, orientation: tearOrientation })
      await assignSections(code, session?.players || {})
      setTimeout(async () => {
        await updateSessionStatus(code, 'ready_check')
        navigate(`/session/${code}/ready`)
      }, 1800)
    } catch {
      setTimeout(() => navigate(`/session/${code}/ready`), 1800)
    }
  }

  const displaySize = 300
  const top = split?.top ?? 50
  const bottom = split?.bottom ?? 50
  const fair = top >= 40 && bottom >= 40

  return (
    <motion.div
      className="min-h-screen bg-cream flex flex-col items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="flex items-center gap-4 w-full px-6 pt-8 pb-2">
        <button onClick={() => setShowLeaveModal(true)} className="text-ink/50 font-body active:scale-95 text-lg">←</button>
        <h1 className="font-display text-2xl text-ink" style={{ fontFamily: "'Fredoka One', cursive" }}>
          Tear the Page
        </h1>
      </div>
      <RoomStatusBar session={session} code={code} />

      {/* Loading — session not yet received */}
      {!session ? (
        <div className="flex flex-col items-center justify-center flex-1 px-6 gap-4">
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.4 }} className="text-5xl">✂️</motion.div>
          <p className="text-ink/40 font-body text-sm">Loading…</p>
        </div>
      ) : !isController ? (
        /* Non-controller: simple waiting screen — stale local preview is never shown */
        <div className="flex flex-col items-center justify-center flex-1 px-6 gap-5">
          <motion.div
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            className="text-6xl"
          >
            ✂️
          </motion.div>
          <p className="text-ink/55 font-body text-base text-center">
            {controllerName} is choosing the split…
          </p>
        </div>
      ) : (
        /* Controller (or loading): full tear editor */
        <>
          <p className="text-ink/50 font-body text-sm px-6 mb-5 text-center">
            Swipe across the preview to tear, or tap &ldquo;Randomize&rdquo;
          </p>

          <div className="px-6 w-full max-w-sm">
            <AnimatePresence mode="wait">
              {tearing ? (
                <motion.div
                  key="anim"
                  className="relative aspect-square rounded-3xl overflow-hidden bg-white shadow-deep"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 1 }}
                >
                  <motion.div className="absolute inset-0 flex">
                    <motion.div
                      className="w-1/2 h-full bg-blue-50 flex items-center justify-center"
                      animate={{ x: -50, rotate: -6 }}
                      transition={{ delay: 0.1, type: 'spring', stiffness: 180, damping: 18 }}
                    >
                      <span className="text-5xl">📄</span>
                    </motion.div>
                    <motion.div
                      className="w-1/2 h-full bg-blue-100 flex items-center justify-center"
                      animate={{ x: 50, rotate: 6 }}
                      transition={{ delay: 0.1, type: 'spring', stiffness: 180, damping: 18 }}
                    >
                      <span className="text-5xl">📄</span>
                    </motion.div>
                  </motion.div>
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <span className="text-6xl">✂️</span>
                  </motion.div>
                </motion.div>
              ) : (
                <motion.div
                  key="canvas"
                  ref={containerRef}
                  className="relative aspect-square rounded-3xl overflow-hidden bg-white shadow-paper border border-ink/10 touch-none"
                  style={{ width: displaySize, height: displaySize, maxWidth: '100%', margin: '0 auto' }}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <div className="w-full h-full flex items-center justify-center opacity-20">
                    <span className="text-9xl">🎨</span>
                  </div>
                  {tearPoints && <TearPath points={tearPoints} size={displaySize} />}
                  {split && (
                    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
                      <div className="absolute top-3 left-3">
                        <div className={`bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 font-display text-lg shadow-sm ${fair ? 'text-ink' : 'text-red-500'}`} style={{ fontFamily: "'Fredoka One', cursive" }}>
                          {top}%
                        </div>
                      </div>
                      <div className="absolute bottom-3 right-3">
                        <div className={`bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 font-display text-lg shadow-sm ${fair ? 'text-ink' : 'text-red-500'}`} style={{ fontFamily: "'Fredoka One', cursive" }}>
                          {bottom}%
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {tooSkewed && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-red-600 font-body text-sm text-center"
                >
                  Too uneven! Each player needs at least 40% of the page.
                </motion.div>
              )}
            </AnimatePresence>

            {!tearing && (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={newTear}
                  className="flex-1 bg-white text-ink font-semibold py-3 rounded-2xl shadow-paper border border-ink/10 font-body text-sm active:scale-95 transition-transform"
                >
                  🎲 Randomize
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 bg-blue-500 text-white font-bold py-3 rounded-2xl shadow-lifted font-body text-sm active:scale-95 transition-all"
                >
                  Confirm ✓
                </button>
              </div>
            )}
            {!tearing && (
              <p className="text-center text-ink/35 text-xs font-body mt-3">
                Or swipe across the preview above to tear manually
              </p>
            )}
          </div>
        </>
      )}
      <LeaveRoomModal
        showConfirm={showLeaveModal}
        onCancel={() => setShowLeaveModal(false)}
        onConfirm={handleLeaveConfirm}
        abandonedByName={abandonedByName}
        onGoHome={() => { isLeavingRef.current = true; navigate('/', { replace: true }) }}
      />
    </motion.div>
  )
}
