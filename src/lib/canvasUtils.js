/**
 * canvasUtils.js — gedeelde canvas-helpers voor ColorSplit.
 *
 * Exporteert:
 *   smoothPoints(pts)                                   — moving-average smoothing
 *   buildAllowedMask(tearPoints, section, orientation)  — offscreen masking canvas
 *   buildRevealMask(tearPoints, section, orientation)   — reveal mask met 2px naad-overlap
 *   drawStroke(ctx, stroke)                             — teken een volledige stroke (replay / restore)
 *
 * Elke functie is een pure utility zonder side-effects op React state of Firebase.
 */

const CANVAS_SIZE = 800

// ─── Smoothing ────────────────────────────────────────────────────────────────

/**
 * 3-punt moving-average over een array van {x, y} punten.
 * Eerste en laatste punt blijven ongewijzigd.
 */
export function smoothPoints(pts) {
  if (pts.length < 3) return pts
  const s = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    s.push({
      x: (pts[i - 1].x + pts[i].x + pts[i + 1].x) / 3,
      y: (pts[i - 1].y + pts[i].y + pts[i + 1].y) / 3,
    })
  }
  s.push(pts[pts.length - 1])
  return s
}

// ─── Masking ──────────────────────────────────────────────────────────────────

/**
 * Bouw een offscreen masking canvas voor het toegestane tekengebied.
 *
 * orientation 'horizontal': 'left' = boven de lijn, 'right' = onder de lijn.
 * orientation 'vertical':   'left' = links van de lijn, 'right' = rechts.
 *
 * Witte pixels = toegestaan, transparant = verboden.
 * Gebruik met globalCompositeOperation = 'destination-in' om buiten-pixels te wissen.
 */
export function buildAllowedMask(tearPoints, section, orientation = 'horizontal') {
  const offscreen = document.createElement('canvas')
  offscreen.width = CANVAS_SIZE
  offscreen.height = CANVAS_SIZE
  const ctx = offscreen.getContext('2d')
  const scale = CANVAS_SIZE / 400
  const sc = tearPoints.map(p => ({ x: p.x * scale, y: p.y * scale }))
  const last = sc.length - 1
  const E = 2, W = CANVAS_SIZE, H = CANVAS_SIZE
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  if (orientation === 'vertical') {
    if (section === 'left') {
      ctx.moveTo(-E, -E); ctx.lineTo(sc[0].x, -E)
      for (let i = 0; i <= last; i++) ctx.lineTo(sc[i].x, sc[i].y)
      ctx.lineTo(sc[last].x, H + E); ctx.lineTo(-E, H + E)
    } else {
      ctx.moveTo(sc[0].x, -E); ctx.lineTo(W + E, -E)
      ctx.lineTo(W + E, H + E); ctx.lineTo(sc[last].x, H + E)
      for (let i = last; i >= 0; i--) ctx.lineTo(sc[i].x, sc[i].y)
    }
  } else {
    if (section === 'left') {
      ctx.moveTo(-E, -E); ctx.lineTo(W + E, -E); ctx.lineTo(W + E, sc[last].y)
      for (let i = last; i >= 0; i--) ctx.lineTo(sc[i].x, sc[i].y)
      ctx.lineTo(-E, sc[0].y)
    } else {
      ctx.moveTo(-E, sc[0].y)
      for (let i = 0; i <= last; i++) ctx.lineTo(sc[i].x, sc[i].y)
      ctx.lineTo(W + E, sc[last].y); ctx.lineTo(W + E, H + E); ctx.lineTo(-E, H + E)
    }
  }
  ctx.closePath(); ctx.fill()
  return offscreen
}

/**
 * Variant van buildAllowedMask voor de reveal-compositie.
 * Verschuift de naad 2px richting de andere sectie om de anti-aliasing opening te dichten.
 */
export function buildRevealMask(tearPoints, section, orientation = 'horizontal') {
  const offscreen = document.createElement('canvas')
  offscreen.width = CANVAS_SIZE
  offscreen.height = CANVAS_SIZE
  const ctx = offscreen.getContext('2d')
  const scale = CANVAS_SIZE / 400
  const SEAM = 2
  let sc
  if (orientation === 'vertical') {
    const dx = section === 'left' ? SEAM : -SEAM
    sc = tearPoints.map(p => ({ x: p.x * scale + dx, y: p.y * scale }))
  } else {
    const dy = section === 'left' ? SEAM : -SEAM
    sc = tearPoints.map(p => ({ x: p.x * scale, y: p.y * scale + dy }))
  }
  const last = sc.length - 1
  const E = 2, W = CANVAS_SIZE, H = CANVAS_SIZE
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  if (orientation === 'vertical') {
    if (section === 'left') {
      ctx.moveTo(-E, -E); ctx.lineTo(sc[0].x, -E)
      for (let i = 0; i <= last; i++) ctx.lineTo(sc[i].x, sc[i].y)
      ctx.lineTo(sc[last].x, H + E); ctx.lineTo(-E, H + E)
    } else {
      ctx.moveTo(sc[0].x, -E); ctx.lineTo(W + E, -E)
      ctx.lineTo(W + E, H + E); ctx.lineTo(sc[last].x, H + E)
      for (let i = last; i >= 0; i--) ctx.lineTo(sc[i].x, sc[i].y)
    }
  } else {
    if (section === 'left') {
      ctx.moveTo(-E, -E); ctx.lineTo(W + E, -E); ctx.lineTo(W + E, sc[last].y)
      for (let i = last; i >= 0; i--) ctx.lineTo(sc[i].x, sc[i].y)
      ctx.lineTo(-E, sc[0].y)
    } else {
      ctx.moveTo(-E, sc[0].y)
      for (let i = 0; i <= last; i++) ctx.lineTo(sc[i].x, sc[i].y)
      ctx.lineTo(W + E, sc[last].y); ctx.lineTo(W + E, H + E); ctx.lineTo(-E, H + E)
    }
  }
  ctx.closePath(); ctx.fill()
  return offscreen
}

// ─── Stroke rendering ─────────────────────────────────────────────────────────

/**
 * Teken een volledige stroke op een canvas context.
 * Gebruikt voor replay, gallery, en restore vanuit Firebase.
 * Animatie-loops (TimeLapsePlayer, MaskedTearReplay) gebruiken hun eigen
 * segment-by-segment logica en roepen deze functie NIET aan.
 *
 * stroke: { points, color, opacity, size, tool }
 * tool === 'eraser' → destination-out met globalAlpha 1 (volledige pixel-verwijdering)
 */
export function drawStroke(ctx, stroke) {
  const pts = stroke.points
  if (!pts || pts.length < 2) return
  const smoothed = smoothPoints(pts)
  const isEraser = stroke.tool === 'eraser'
  ctx.save()
  ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over'
  ctx.globalAlpha = isEraser ? 1 : (stroke.opacity ?? 1)
  ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : (stroke.color || '#000000')
  ctx.lineWidth = stroke.size || 12
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(smoothed[0].x, smoothed[0].y)
  for (let i = 1; i < smoothed.length; i++) {
    const mx = (smoothed[i - 1].x + smoothed[i].x) / 2
    const my = (smoothed[i - 1].y + smoothed[i].y) / 2
    ctx.quadraticCurveTo(smoothed[i - 1].x, smoothed[i - 1].y, mx, my)
  }
  ctx.stroke()
  ctx.restore()
}
