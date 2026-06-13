import { useEffect, useRef, useState } from 'react'
import { buildAllowedMask, smoothPoints } from '../lib/canvasUtils'

const CANVAS_SIZE = 800
const POINTS_PER_FRAME = 8
const PAUSE_BETWEEN_STROKES = 2

/**
 * MaskedTearReplay
 *
 * Replays all players' strokes in chronological order at 8× speed.
 * Each player's strokes are masked to their assigned section — color never
 * crosses the tear line.
 *
 * Uses the same point-by-point frame model as TimeLapsePlayer so the drawing
 * feels animated, not instant.
 *
 * Props:
 *   allStrokes   {[playerId]: {[strokeId]: stroke}}
 *   sessionData  session object — needs tearLine.points + players[pid].assignedSection
 *   colorPage    {svgContent} | {uploadDataUrl} | null
 *   width        CSS display size in px (internal canvas stays 800×800)
 *   onComplete   fn() — called when all strokes have been played
 */
export default function MaskedTearReplay({ allStrokes, sessionData, colorPage, width, onComplete }) {
  const displayRef = useRef(null)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    const rafRef = { current: null }

    async function run() {
      const tearPoints = sessionData?.tearLine?.points
      if (!tearPoints?.length) { onComplete?.(); return }

      const players = Object.entries(sessionData.players || {})
        .filter(([, p]) => p.assignedSection)
        .map(([pid, p]) => ({ pid, section: p.assignedSection }))
      if (!players.length) { onComplete?.(); return }

      // Flatten + sort all strokes by timestamp
      const sortedStrokes = []
      for (const { pid } of players) {
        for (const stroke of Object.values(allStrokes?.[pid] || {})) {
          if (stroke?.points?.length) sortedStrokes.push({ stroke, pid })
        }
      }
      sortedStrokes.sort((a, b) => (a.stroke.timestamp || 0) - (b.stroke.timestamp || 0))
      if (!sortedStrokes.length) { onComplete?.(); return }

      const orientation = sessionData?.tearLine?.orientation ?? 'horizontal'

      // Per-player offscreen accumulation canvas + section mask
      const playerCanvases = {}
      const playerMasks = {}
      for (const { pid, section } of players) {
        const c = document.createElement('canvas')
        c.width = CANVAS_SIZE
        c.height = CANVAS_SIZE
        playerCanvases[pid] = c
        playerMasks[pid] = buildAllowedMask(tearPoints, section, orientation)
      }

      // Load contour image before animating so it's ready on frame 1
      let contourImg = null
      await new Promise((resolve) => {
        if (!colorPage) { resolve(); return }
        const img = new Image()
        img.onerror = () => resolve()
        if (colorPage.svgContent) {
          const blob = new Blob([colorPage.svgContent], { type: 'image/svg+xml' })
          const url = URL.createObjectURL(blob)
          img.onload = () => {
            if (!cancelled) contourImg = img
            URL.revokeObjectURL(url)
            resolve()
          }
          img.src = url
        } else if (colorPage.uploadDataUrl || colorPage.imageUrl) {
          img.onload = () => { if (!cancelled) contourImg = img; resolve() }
          img.src = colorPage.uploadDataUrl || colorPage.imageUrl
        } else {
          resolve()
        }
      })

      if (cancelled) return
      const displayCanvas = displayRef.current
      if (!displayCanvas) return
      const displayCtx = displayCanvas.getContext('2d')

      // Clip accumulated canvas to section after each draw segment
      function applyMask(pid) {
        const ctx = playerCanvases[pid].getContext('2d')
        ctx.save()
        ctx.globalCompositeOperation = 'destination-in'
        ctx.drawImage(playerMasks[pid], 0, 0)
        ctx.restore()
      }

      // Composite all player canvases (already masked) + contour onto display
      function compositeFrame() {
        displayCtx.fillStyle = '#ffffff'
        displayCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
        for (const { pid } of players) {
          displayCtx.drawImage(playerCanvases[pid], 0, 0)
        }
        if (contourImg) {
          displayCtx.save()
          displayCtx.globalCompositeOperation = 'multiply'
          displayCtx.drawImage(contourImg, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
          displayCtx.restore()
        }
      }

      const totalPts = sortedStrokes.reduce((n, { stroke }) => n + (stroke.points?.length || 0), 0)
      let drawn = 0
      let sIdx = 0
      let pIdx = 0
      let wait = 0

      function frame() {
        if (cancelled) return

        // All strokes done
        if (sIdx >= sortedStrokes.length) {
          for (const { pid } of players) applyMask(pid)
          compositeFrame()
          setProgress(100)
          setDone(true)
          onComplete?.()
          return
        }

        if (wait > 0) {
          wait--
          rafRef.current = requestAnimationFrame(frame)
          return
        }

        const { stroke, pid } = sortedStrokes[sIdx]
        const pts = smoothPoints(stroke.points || [])
        if (!pts.length) { sIdx++; rafRef.current = requestAnimationFrame(frame); return }

        const ctx = playerCanvases[pid].getContext('2d')
        const from = pIdx
        const to = Math.min(pIdx + POINTS_PER_FRAME - 1, pts.length - 1)
        const isEraser = stroke.tool === 'eraser'

        ctx.save()
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over'
        ctx.globalAlpha = isEraser ? 1 : (stroke.opacity ?? 1)
        ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : (stroke.color || '#000')
        ctx.lineWidth = stroke.size || 12
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(pts[Math.max(0, from - 1)].x, pts[Math.max(0, from - 1)].y)
        for (let i = from; i <= to; i++) ctx.lineTo(pts[i].x, pts[i].y)
        ctx.stroke()
        ctx.restore()

        // Keep strokes clipped to the player's section after every segment
        applyMask(pid)
        compositeFrame()

        drawn += to - from + 1
        pIdx = to + 1
        if (pIdx >= pts.length) { sIdx++; pIdx = 0; wait = PAUSE_BETWEEN_STROKES }

        setProgress(Math.min(99, Math.round((drawn / totalPts) * 100)))
        rafRef.current = requestAnimationFrame(frame)
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    run()

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const size = typeof width === 'number' ? width : 340

  return (
    <div
      className="relative overflow-hidden rounded-3xl bg-white shadow-deep"
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      <canvas
        ref={displayRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
      {!done && (
        <div className="absolute bottom-3 left-3 z-10 bg-black/60 backdrop-blur-sm text-white text-xs font-body px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
          <span>⏩</span>
          <span>8× replay · {progress}%</span>
        </div>
      )}
    </div>
  )
}
