import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { setTearLine, setZones, updateSessionStatus, assignSections, getOrCreatePlayerId, subscribeToSession, leaveRoom } from '../lib/session'
import { COLORING_PAGES } from '../lib/coloringPages'
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

function getPagePreviewSrc(pageId, code) {
  if (!pageId) return null
  if (pageId === 'upload') return sessionStorage.getItem(`colorsplit_upload_${code}`) || null
  const page = COLORING_PAGES.find(p => p.id === pageId)
  if (!page) return null
  if (page.thumbnailUrl) return page.thumbnailUrl
  if (page.imageUrl) return page.imageUrl
  if (page.svgContent) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(page.svgContent)}`
  return null
}

function TearPath({ points, size = 300 }) {
  if (!points?.length) return null
  const scale = size / 400
  const d = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${Math.round(p.x * scale)},${Math.round(p.y * scale)}`
  ).join(' ')
  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }} width={size} height={size}>
      <defs>
        <filter id="tear-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* White backing for legibility over dark artwork areas */}
      <path d={d} stroke="white" strokeWidth="5" fill="none" strokeDasharray="7,5" strokeLinecap="round" strokeOpacity="0.6" />
      {/* Neon coral-pink line with glow */}
      <path d={d} stroke="#FF5C8A" strokeWidth="2.5" fill="none" strokeDasharray="7,5" strokeLinecap="round" filter="url(#tear-glow)" />
    </svg>
  )
}

// Pure helper for future 3/4-player zone generation. Not wired into any live
// flow yet. Produces straight closed horizontal band polygons in 0–400 space.
// Returns null for unsupported counts.
function generateBandedZones(count) {
  if (count !== 3 && count !== 4) return null
  const W = 400, H = 400
  const splits = count === 3
    ? [Math.round(H / 3), Math.round((H * 2) / 3)]
    : [100, 200, 300]
  const boundaries = [0, ...splits, H]
  const zones = {}
  for (let i = 0; i < count; i++) {
    const y0 = boundaries[i]
    const y1 = boundaries[i + 1]
    zones[`zone${i}`] = {
      polygon: [
        { x: 0, y: y0 },
        { x: W, y: y0 },
        { x: W, y: y1 },
        { x: 0, y: y1 },
      ],
      areaPercent: Math.round(((y1 - y0) / H) * 100),
    }
  }
  return zones
}

// Three organic radial shard zones from a near-center anchor. Each of the three
// boundaries (anchor→edge) is a shared wavy polyline so adjacent zones touch
// with exactly the same points, guaranteeing no gaps or overlaps.
function generateRadialZones() {
  const W = 400, H = 400, PERIM = 1600
  const CANVAS_AREA = W * H

  const perimPoint = (d) => {
    d = ((d % PERIM) + PERIM) % PERIM
    if (d <= 400) return { x: d, y: 0 }
    if (d <= 800) return { x: 400, y: d - 400 }
    if (d <= 1200) return { x: 1200 - d, y: 400 }
    return { x: 0, y: 1600 - d }
  }

  const perimDist = (pt) => {
    if (Math.abs(pt.y) < 0.5) return pt.x
    if (Math.abs(pt.x - 400) < 0.5) return 400 + pt.y
    if (Math.abs(pt.y - 400) < 0.5) return 800 + (400 - pt.x)
    return 1200 + (400 - pt.y)
  }

  const polyArea = (pts) => {
    let a = 0
    const n = pts.length
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      a += pts[i].x * pts[j].y - pts[j].x * pts[i].y
    }
    return Math.abs(a) / 2
  }

  const rayHit = (px, py, theta) => {
    const dx = Math.cos(theta), dy = Math.sin(theta)
    let minT = Infinity, hit = { x: px, y: py }
    if (dx > 1e-9) { const t = (W - px) / dx; const y = py + t * dy; if (t > 1e-9 && y >= -0.5 && y <= H + 0.5 && t < minT) { minT = t; hit = { x: W, y: Math.max(0, Math.min(H, y)) } } }
    if (dx < -1e-9) { const t = -px / dx; const y = py + t * dy; if (t > 1e-9 && y >= -0.5 && y <= H + 0.5 && t < minT) { minT = t; hit = { x: 0, y: Math.max(0, Math.min(H, y)) } } }
    if (dy > 1e-9) { const t = (H - py) / dy; const x = px + t * dx; if (t > 1e-9 && x >= -0.5 && x <= W + 0.5 && t < minT) { minT = t; hit = { x: Math.max(0, Math.min(W, x)), y: H } } }
    if (dy < -1e-9) { const t = -py / dy; const x = px + t * dx; if (t > 1e-9 && x >= -0.5 && x <= W + 0.5 && t < minT) { minT = t; hit = { x: Math.max(0, Math.min(W, x)), y: 0 } } }
    return hit
  }

  const arc = (d1, d2) => {
    let end = d2
    while (end <= d1) end += PERIM
    const pts = [perimPoint(d1)]
    for (let c = 0; c <= 2 * PERIM; c += 400) {
      if (c > d1 && c < end) pts.push(perimPoint(c))
    }
    pts.push(perimPoint(d2))
    return pts
  }

  // Build a shared wavy boundary: [anchor, wp1, wp2, hit].
  // Two intermediate waypoints are placed at t=0.35 and t=0.65 along the
  // straight anchor→hit line, then displaced perpendicularly. Offset is capped
  // at 15% of boundary length (max 55px) and all points are clamped to canvas.
  const makeBoundary = (ax, ay, hit) => {
    const dx = hit.x - ax, dy = hit.y - ay
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 1) return [{ x: ax, y: ay }, hit]
    const nx = -dy / len, ny = dx / len
    const maxOff = Math.min(len * 0.15, 55)
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
    const off1 = (Math.random() - 0.5) * 2 * maxOff
    const off2 = (Math.random() - 0.5) * 2 * maxOff
    return [
      { x: ax, y: ay },
      { x: clamp(ax + dx * 0.35 + nx * off1, 0, W), y: clamp(ay + dy * 0.35 + ny * off1, 0, H) },
      { x: clamp(ax + dx * 0.65 + nx * off2, 0, W), y: clamp(ay + dy * 0.65 + ny * off2, 0, H) },
      hit,
    ]
  }

  // Assemble a zone polygon from two boundaries and the perimeter arc between them.
  // Sequence: anchor → [Bstart interior: wp1, wp2, h_start] → [arc: interior corners
  // + h_end] → [Bend reversed: wp2, wp1] → (implicit close to anchor).
  // arcPts.slice(1) keeps h_end so no vertex is dropped at zone junctions.
  // [Bend].reverse().slice(1,-1) skips the now-present h_end duplicate and the
  // trailing anchor (polygon closes implicitly), so shared boundaries are exact.
  const buildZone = (anchor, Bstart, arcD1, arcD2, Bend) => {
    const arcPts = arc(arcD1, arcD2)
    return [
      anchor,
      ...Bstart.slice(1),                  // wp1, wp2, h_start
      ...arcPts.slice(1),                  // interior corners + h_end
      ...[...Bend].reverse().slice(1, -1), // wp2_end, wp1_end (no h_end dup, no anchor)
    ]
  }

  for (let attempt = 0; attempt < 12; attempt++) {
    const px = 200 + (Math.random() - 0.5) * 40
    const py = 200 + (Math.random() - 0.5) * 40
    const base = Math.random() * Math.PI * 2
    const STEP = (Math.PI * 2) / 3
    const angles = [base, base + STEP, base + STEP * 2]

    const hits = angles.map(a => rayHit(px, py, a))
    const order = [0, 1, 2].sort((a, b) => perimDist(hits[a]) - perimDist(hits[b]))
    const h = order.map(i => hits[i])
    const d = h.map(pt => perimDist(pt))

    // Three shared boundary polylines — B0 between zone2/zone0, B1 between zone0/zone1,
    // B2 between zone1/zone2. Each is [anchor, wp1, wp2, hit].
    const B0 = makeBoundary(px, py, h[0])
    const B1 = makeBoundary(px, py, h[1])
    const B2 = makeBoundary(px, py, h[2])

    const anchor = { x: px, y: py }
    const poly0 = buildZone(anchor, B0, d[0], d[1], B1)
    const poly1 = buildZone(anchor, B1, d[1], d[2], B2)
    const poly2 = buildZone(anchor, B2, d[2], d[0], B0)

    const polys = [poly0, poly1, poly2]
    const areas = polys.map(p => polyArea(p))
    const totalArea = areas.reduce((s, a) => s + a, 0)
    if (totalArea < 1) continue
    const p0 = Math.round((areas[0] / totalArea) * 100)
    const p1 = Math.round((areas[1] / totalArea) * 100)
    const pcts = [p0, p1, 100 - p0 - p1]

    if (pcts.every(p => p >= 25 && p <= 42)) {
      return {
        zone0: { polygon: poly0, areaPercent: pcts[0] },
        zone1: { polygon: poly1, areaPercent: pcts[1] },
        zone2: { polygon: poly2, areaPercent: pcts[2] },
      }
    }
  }

  // Fallback: straight radial (always balanced, no wavy offsets).
  const px2 = 200 + (Math.random() - 0.5) * 30
  const py2 = 200 + (Math.random() - 0.5) * 30
  const base2 = Math.random() * Math.PI * 2
  const STEP = (Math.PI * 2) / 3
  const angles2 = [base2, base2 + STEP, base2 + STEP * 2]
  const dists2 = angles2.map(a => perimDist(rayHit(px2, py2, a))).sort((a, b) => a - b)
  const fp0 = [{ x: px2, y: py2 }, ...arc(dists2[0], dists2[1])]
  const fp1 = [{ x: px2, y: py2 }, ...arc(dists2[1], dists2[2])]
  const fp2 = [{ x: px2, y: py2 }, ...arc(dists2[2], dists2[0])]
  const fAreas = [fp0, fp1, fp2].map(p => polyArea(p))
  const fTotal = fAreas.reduce((s, a) => s + a, 0)
  const fp0pct = Math.round((fAreas[0] / fTotal) * 100)
  const fp1pct = Math.round((fAreas[1] / fTotal) * 100)
  const fpcts = [fp0pct, fp1pct, 100 - fp0pct - fp1pct]
  return {
    zone0: { polygon: fp0, areaPercent: fpcts[0] },
    zone1: { polygon: fp1, areaPercent: fpcts[1] },
    zone2: { polygon: fp2, areaPercent: fpcts[2] },
  }
}

// Organic 2×2 cross-style split for 4 players. One wavy vertical boundary
// (top edge → centre → bottom edge) and one wavy horizontal boundary
// (left edge → centre → right edge) cross near the middle, producing four
// connected quadrant zones (zone0 TL, zone1 TR, zone2 BR, zone3 BL). Every
// interior boundary segment is reused by its two neighbours in reverse order,
// so the four polygons partition the full 400×400 canvas with no gaps,
// no missing area, and no overlap. Not pizza slices, not horizontal bands.
function generateCrossZones() {
  const W = 400, H = 400
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

  const polyArea = (pts) => {
    let a = 0
    const n = pts.length
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      a += pts[i].x * pts[j].y - pts[j].x * pts[i].y
    }
    return Math.abs(a) / 2
  }

  // One organic waypoint halfway between an edge point and the centre,
  // displaced perpendicular to that line. Offset capped at 28% of the segment
  // length (max 42px) and clamped so it never leaves the canvas.
  const midWaypoint = (p, c) => {
    const dx = c.x - p.x, dy = c.y - p.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const nx = -dy / len, ny = dx / len
    const maxOff = Math.min(len * 0.28, 42)
    const off = (Math.random() - 0.5) * 2 * maxOff
    return {
      x: clamp(p.x + dx * 0.5 + nx * off, 0, W),
      y: clamp(p.y + dy * 0.5 + ny * off, 0, H),
    }
  }

  for (let attempt = 0; attempt < 12; attempt++) {
    // Centre crossing point near the middle; edge anchors near each edge's mid.
    const C = { x: 185 + Math.random() * 30, y: 185 + Math.random() * 30 }
    const T = { x: clamp(200 + (Math.random() - 0.5) * 80, 0, W), y: 0 }
    const B = { x: clamp(200 + (Math.random() - 0.5) * 80, 0, W), y: H }
    const L = { x: 0, y: clamp(200 + (Math.random() - 0.5) * 80, 0, H) }
    const R = { x: W, y: clamp(200 + (Math.random() - 0.5) * 80, 0, H) }

    const vT = midWaypoint(T, C) // shared vertical-top    (T … C)
    const vB = midWaypoint(B, C) // shared vertical-bottom (C … B)
    const hL = midWaypoint(L, C) // shared horizontal-left (L … C)
    const hR = midWaypoint(R, C) // shared horizontal-right(C … R)

    const TL = { x: 0, y: 0 }, TR = { x: W, y: 0 }, BR = { x: W, y: H }, BL = { x: 0, y: H }

    // Shared interior boundaries — each used once forward, once reversed:
    //   T–vT–C  : zone0 forward, zone1 reversed
    //   C–hR–R  : zone2 forward, zone1 reversed
    //   C–vB–B  : zone3 forward, zone2 reversed
    //   L–hL–C  : zone3 forward, zone0 reversed
    const poly0 = [TL, T, vT, C, hL, L] // top-left
    const poly1 = [T, TR, R, hR, C, vT] // top-right
    const poly2 = [R, BR, B, vB, C, hR] // bottom-right
    const poly3 = [L, hL, C, vB, B, BL] // bottom-left

    const polys = [poly0, poly1, poly2, poly3]
    const areas = polys.map(polyArea)
    const total = areas.reduce((s, a) => s + a, 0)
    if (total < 1) continue
    const p0 = Math.round((areas[0] / total) * 100)
    const p1 = Math.round((areas[1] / total) * 100)
    const p2 = Math.round((areas[2] / total) * 100)
    const pcts = [p0, p1, p2, 100 - p0 - p1 - p2] // normalized to total 100

    if (pcts.every(p => p >= 18 && p <= 32)) {
      return {
        zone0: { polygon: poly0, areaPercent: pcts[0] },
        zone1: { polygon: poly1, areaPercent: pcts[1] },
        zone2: { polygon: poly2, areaPercent: pcts[2] },
        zone3: { polygon: poly3, areaPercent: pcts[3] },
      }
    }
  }

  // Fallback: safe straight 2×2 rectangular split — exact partition, 25% each.
  const M = 200
  return {
    zone0: { polygon: [{ x: 0, y: 0 }, { x: M, y: 0 }, { x: M, y: M }, { x: 0, y: M }], areaPercent: 25 },
    zone1: { polygon: [{ x: M, y: 0 }, { x: W, y: 0 }, { x: W, y: M }, { x: M, y: M }], areaPercent: 25 },
    zone2: { polygon: [{ x: M, y: M }, { x: W, y: M }, { x: W, y: H }, { x: M, y: H }], areaPercent: 25 },
    zone3: { polygon: [{ x: 0, y: M }, { x: M, y: M }, { x: M, y: H }, { x: 0, y: H }], areaPercent: 25 },
  }
}

export default function TearScreen() {
  const { code } = useParams()
  const navigate = useNavigate()
  const playerId = getOrCreatePlayerId()
  const [session, setSession] = useState(null)
  const [tearPoints, setTearPoints] = useState(null)
  const [tearOrientation, setTearOrientation] = useState('horizontal')
  const [split, setSplit] = useState(null)
  const [tooSkewed, setTooSkewed] = useState(false)
  const [radialZones, setRadialZones] = useState(null)
  const [crossZones, setCrossZones] = useState(null)
  const [tearing, setTearing] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [abandonedByName, setAbandonedByName] = useState(null)
  const containerRef = useRef(null)
  const isLeavingRef = useRef(false)
  const disconnectTimerRef = useRef(null)

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
      // Controller/host left while others remain (3/4-player): without this the
      // remaining non-controllers stay stuck on "…is choosing the split" forever,
      // since controllerId still points at the departed player and status never
      // advances. Show them the same abandoned overlay so they can go home.
      const controllerId = data.roundControllerId || data.hostId
      const controllerPlayer = data.players?.[controllerId]
      if (controllerId !== playerId && controllerPlayer?.left === true) {
        console.warn('[TearScreen][sub] controller-left branch REACHED — showing abandoned overlay', { controllerId, name: controllerPlayer?.name })
        setAbandonedByName(controllerPlayer?.name || 'The host'); return
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
    try {
      await leaveRoom(code, playerId)
    } catch (err) {
      console.warn('[TearScreen][leave] leaveRoom THREW', err)
    }
    navigate('/', { replace: true })
  }

  const controllerId = session?.roundControllerId || session?.hostId
  const isController = controllerId === playerId
  const controllerName = session?.players?.[controllerId]?.name || 'Other player'

  const activePlayers = Object.entries(session?.players || {})
    .filter(([, p]) => p.name && !p.left)
  const playerCount = activePlayers.length

  // Controller disconnect (tab/app closed) without an explicit leave: presence
  // flips `connected` to false but `left` stays false, so the subscription's
  // immediate `left === true` check never fires. Wait out a grace period for
  // mobile/network flicker, then end the room for the remaining players if the
  // controller is still gone. (Explicit leave stays immediate via the
  // subscription callback; this only covers silent disconnects.)
  const controllerConnected = session?.players?.[controllerId]?.connected
  const controllerLeft = session?.players?.[controllerId]?.left
  useEffect(() => {
    const clear = () => {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current)
        disconnectTimerRef.current = null
      }
    }
    // No timer needed when: we are the controller, the controller is gone via
    // explicit leave (handled immediately elsewhere), or it's connected/unknown.
    if (isController || controllerLeft === true || controllerConnected !== false) {
      clear()
      return
    }
    if (!disconnectTimerRef.current) {
      disconnectTimerRef.current = setTimeout(() => {
        disconnectTimerRef.current = null
        // Re-check against the latest session: only end the room if the
        // controller is STILL disconnected, hasn't left, and hasn't reconnected.
        const latest = session?.players?.[controllerId]
        if (controllerId !== playerId && latest && latest.left !== true && latest.connected === false) {
          setAbandonedByName(latest.name || 'The host')
        }
      }, 9000)
    }
    return clear
  }, [controllerId, controllerConnected, controllerLeft, isController, playerId])

  useEffect(() => {
    if (playerCount === 3 && isController && !radialZones) {
      setRadialZones(generateRadialZones() || generateBandedZones(3))
    }
  }, [playerCount, isController])

  useEffect(() => {
    if (playerCount === 4 && isController && !crossZones) {
      setCrossZones(generateCrossZones())
    }
  }, [playerCount, isController])

  // Polygon-zone preview source: 3-player uses radial shards, 4-player uses the
  // organic 2×2 cross. Other counts fall back to the 2-player tear-line editor.
  const polygonZones = playerCount === 3 ? radialZones : playerCount === 4 ? crossZones : null

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


  async function handleConfirm() {
    const s = calculateSplit(tearPoints, tearOrientation)
    if (playerCount < 3 && (s.top < 40 || s.bottom < 40)) { setTooSkewed(true); return }

    if (playerCount < 2) return

    setTearing(true)

    if (playerCount >= 3) {
      const zones = playerCount === 3
        ? (radialZones || generateRadialZones() || generateBandedZones(3))
        : playerCount === 4
          ? (crossZones || generateCrossZones() || generateBandedZones(4))
          : generateBandedZones(playerCount)
      if (!zones) return
      try {
        await setZones(code, zones)
        await assignSections(code, session?.players || {})
        setTimeout(async () => {
          await updateSessionStatus(code, 'ready_check')
          navigate(`/session/${code}/ready`)
        }, 1800)
      } catch {
        setTimeout(() => navigate(`/session/${code}/ready`), 1800)
      }
    } else {
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
          Split the page
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
            Choose a split, then confirm.
          </p>

          <div className="px-6 w-full max-w-sm">
            <motion.div
              key="canvas"
              ref={containerRef}
              className="relative aspect-square rounded-3xl overflow-hidden bg-white shadow-paper border border-ink/10"
              style={{ width: displaySize, height: displaySize, maxWidth: '100%', margin: '0 auto' }}
            >
              {(() => {
                const pageId = session?.coloringPage?.id || sessionStorage.getItem(`colorsplit_page_${code}`)
                const previewSrc = getPagePreviewSrc(pageId, code)
                return previewSrc ? (
                  <img src={previewSrc} alt="Coloring page" className="absolute inset-0 w-full h-full object-contain" draggable={false} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center opacity-20">
                    <span className="text-9xl">🎨</span>
                  </div>
                )
              })()}
              {polygonZones ? (() => {
                const scale = displaySize / 400
                const PURPLE = { fill: 'rgba(124,92,255,0.18)', stroke: '#7C5CFF' }
                const PINK = { fill: 'rgba(255,92,138,0.18)', stroke: '#FF5C8A' }
                const GREEN = { fill: 'rgba(52,199,89,0.18)', stroke: '#34C759' }
                const ORANGE = { fill: 'rgba(255,159,10,0.18)', stroke: '#FF9F0A' }
                // Per-zone colors by index — zone0 PURPLE, zone1 PINK, zone2 GREEN
                // (zone3 ORANGE for 4-player). Polygon fill/stroke and the badge all
                // read ZONE_COLORS[i], so each zone's colors always match.
                // Preview-only — geometry and zone assignment are untouched.
                const ZONE_COLORS = [PURPLE, PINK, GREEN, ORANGE]
                // 3-player keeps its original TL/BL/BR badge corners; 4-player
                // places one badge per quadrant (TL, TR, BR, BL).
                const BADGE_POS = playerCount === 4
                  ? [
                      { top: 8, left: 8 },
                      { top: 8, right: 8 },
                      { bottom: 8, right: 8 },
                      { bottom: 8, left: 8 },
                    ]
                  : [
                      { top: 8, left: 8 },
                      { bottom: 8, left: 8 },
                      { bottom: 8, right: 8 },
                    ]
                const zoneList = ['zone0', 'zone1', 'zone2', 'zone3']
                  .map(k => polygonZones[k])
                  .filter(Boolean)
                // Average point position (centroid) of a polygon in 0–400 space.
                const polygonCentroid = (polygon) => {
                  const n = polygon.length || 1
                  return {
                    x: polygon.reduce((s, p) => s + p.x, 0) / n,
                    y: polygon.reduce((s, p) => s + p.y, 0) / n,
                  }
                }
                // 3-player radial shards land in random positions, so fixed corner
                // badges can sit over the wrong zone. Place each badge at its own
                // polygon's centroid (clamped to stay on-canvas). 4-player quadrants
                // keep their fixed corner badges.
                const badgeStyle = (zone, i) => {
                  if (playerCount !== 3) return BADGE_POS[i]
                  const c = polygonCentroid(zone.polygon)
                  const clamp = (v) => Math.max(24, Math.min(displaySize - 24, v * scale))
                  return { left: clamp(c.x), top: clamp(c.y), transform: 'translate(-50%, -50%)' }
                }
                return (
                  <>
                    <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }} width={displaySize} height={displaySize}>
                      {zoneList.map((zone, i) => {
                        const pts = zone.polygon.map(p => `${Math.round(p.x * scale)},${Math.round(p.y * scale)}`).join(' ')
                        return <polygon key={i} points={pts} fill={ZONE_COLORS[i].fill} stroke={ZONE_COLORS[i].stroke} strokeWidth="2" />
                      })}
                    </svg>
                    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
                      {zoneList.map((zone, i) => (
                        <div key={i} className="absolute" style={badgeStyle(zone, i)}>
                          <div className="bg-white/90 backdrop-blur-sm rounded-xl px-3 py-1.5 font-display text-lg shadow-sm text-ink" style={{ fontFamily: "'Fredoka One', cursive", color: ZONE_COLORS[i].stroke }}>
                            {zone.areaPercent}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )
              })() : (
                <>
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
                </>
              )}
            </motion.div>

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

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  if (playerCount === 3) {
                    setRadialZones(generateRadialZones() || generateBandedZones(3))
                    setTooSkewed(false)
                  } else if (playerCount === 4) {
                    setCrossZones(generateCrossZones())
                    setTooSkewed(false)
                  } else {
                    newTear()
                  }
                }}
                disabled={tearing}
                className="flex-1 bg-white text-ink font-semibold py-3 rounded-2xl shadow-paper border border-ink/10 font-body text-sm active:scale-95 transition-transform disabled:opacity-40 disabled:pointer-events-none"
              >
                Shuffle split
              </button>
              <button
                onClick={handleConfirm}
                disabled={tearing}
                className="flex-1 text-white font-bold py-3 rounded-2xl font-body text-sm transition-all disabled:opacity-70 disabled:pointer-events-none"
                style={{ background: '#7C5CFF', boxShadow: tearing ? 'none' : '0 4px 12px rgba(124,92,255,0.25)' }}
              >
                {tearing ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span
                      className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white"
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                    />
                    Preparing…
                  </span>
                ) : 'Confirm ✓'}
              </button>
            </div>
            <p className="text-center text-ink/35 text-xs font-body mt-3">
              {tearing ? 'Preparing your split…' : 'Shuffle the line or confirm to continue.'}
            </p>
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
