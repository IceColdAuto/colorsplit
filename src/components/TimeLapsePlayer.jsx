import { useEffect, useRef, useState } from 'react'
import { smoothPoints } from '../lib/canvasUtils'

const CANVAS_SIZE = 800
const POINTS_PER_FRAME = 8
const PAUSE_BETWEEN_STROKES = 2

/**
 * TimeLapsePlayer
 * Replays an array of strokes on a canvas at ~8× speed.
 *
 * Props:
 *   strokes      — [{points, color, opacity, size, tool, timestamp}]
 *   colorPage    — {svgContent} or {uploadDataUrl} for contour overlay
 *   width        — CSS display width (canvas resolution stays 800)
 *   onComplete   — called when all strokes have been drawn
 *   autoStart    — if false, nothing plays
 *   className    — extra classes on wrapper
 */
export default function TimeLapsePlayer({
  strokes = [],
  colorPage = null,
  width = 340,
  onComplete,
  onCapture,
  autoStart = true,
  className = '',
}) {
  const colorRef = useRef(null)
  const contourRef = useRef(null)
  const animRef = useRef(null)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)

  // Single effect: loads the coloring page FIRST, then starts the animation.
  // This eliminates the race condition where strokes played on a blank canvas.
  useEffect(() => {
    if (!autoStart) return

    let cancelled = false

    async function run() {
      const colorCanvas = colorRef.current
      const contourCanvas = contourRef.current
      if (!colorCanvas) return

      // Clear the color canvas
      const colorCtx = colorCanvas.getContext('2d')
      colorCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

      // Load the coloring page onto the contour canvas and WAIT before animating
      if (contourCanvas) {
        const cCtx = contourCanvas.getContext('2d')
        cCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

        if (colorPage?.svgContent) {
          await new Promise((resolve) => {
            const img = new Image()
            const blob = new Blob([colorPage.svgContent], { type: 'image/svg+xml' })
            const url = URL.createObjectURL(blob)
            img.onload = () => {
              if (!cancelled) cCtx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
              URL.revokeObjectURL(url)
              resolve()
            }
            img.onerror = () => resolve()
            img.src = url
          })
        } else if (colorPage?.uploadDataUrl || colorPage?.imageUrl) {
          await new Promise((resolve) => {
            const img = new Image()
            img.onload = () => {
              if (!cancelled) cCtx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
              resolve()
            }
            img.onerror = () => resolve()
            img.src = colorPage.uploadDataUrl || colorPage.imageUrl
          })
        }
      }

      if (cancelled) return

      function captureCanvas() {
        if (!onCapture || !colorRef.current) return
        const merge = document.createElement('canvas')
        merge.width = CANVAS_SIZE
        merge.height = CANVAS_SIZE
        const mCtx = merge.getContext('2d')
        mCtx.fillStyle = 'white'
        mCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
        mCtx.drawImage(colorRef.current, 0, 0)
        if (contourRef.current) {
          mCtx.globalCompositeOperation = 'multiply'
          mCtx.drawImage(contourRef.current, 0, 0)
        }
        onCapture(merge.toDataURL('image/png'))
      }

      // No strokes → done immediately (coloring page still visible)
      if (!strokes.length) {
        setProgress(100)
        setDone(true)
        captureCanvas()
        onComplete?.()
        return
      }

      const sorted = [...strokes].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      const totalPts = sorted.reduce((n, s) => n + (s.points?.length || 0), 0)
      let drawn = 0
      let sIdx = 0
      let pIdx = 0
      let wait = 0

      function frame() {
        if (cancelled || !colorRef.current) return
        if (sIdx >= sorted.length) {
          setProgress(100)
          setDone(true)
          captureCanvas()
          onComplete?.()
          return
        }

        if (wait > 0) { wait--; animRef.current = requestAnimationFrame(frame); return }

        const stroke = sorted[sIdx]
        const pts = smoothPoints(stroke.points || [])
        if (!pts.length) { sIdx++; animRef.current = requestAnimationFrame(frame); return }

        const ctx = colorRef.current.getContext('2d')
        const from = pIdx
        const to = Math.min(pIdx + POINTS_PER_FRAME - 1, pts.length - 1)

        ctx.save()
        const isEraser = stroke.tool === 'eraser'
        ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over'
        ctx.globalAlpha = isEraser ? 1 : (stroke.opacity ?? 0.85)
        ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : (stroke.color || '#000')
        ctx.lineWidth = stroke.size || 12
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(pts[Math.max(0, from - 1)].x, pts[Math.max(0, from - 1)].y)
        for (let i = from; i <= to; i++) ctx.lineTo(pts[i].x, pts[i].y)
        ctx.stroke()
        ctx.restore()

        drawn += to - from + 1
        pIdx = to + 1

        if (pIdx >= pts.length) { sIdx++; pIdx = 0; wait = PAUSE_BETWEEN_STROKES }

        setProgress(Math.min(99, Math.round((drawn / totalPts) * 100)))
        animRef.current = requestAnimationFrame(frame)
      }

      animRef.current = requestAnimationFrame(frame)
    }

    run()

    return () => {
      cancelled = true
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [strokes, autoStart, colorPage]) // colorPage included so we re-init if it arrives late

  const size = typeof width === 'number' ? width : 340

  return (
    // isolation: isolate ensures mix-blend-mode:multiply stays within this container
    <div
      className={`relative overflow-hidden rounded-3xl bg-white shadow-deep ${className}`}
      style={{ width: size, height: size, flexShrink: 0, isolation: 'isolate' }}
    >
      {/* Color / stroke layer (z=1) */}
      <canvas
        ref={colorRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }}
      />
      {/* Coloring-page contour overlay (z=2, multiply keeps lines always visible) */}
      <canvas
        ref={contourRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          zIndex: 2, mixBlendMode: 'multiply', pointerEvents: 'none',
        }}
      />
      {/* Progress badge */}
      {autoStart && !done && (
        <div className="absolute bottom-3 left-3 z-10 bg-black/60 backdrop-blur-sm text-white text-xs font-body px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
          <span>⏩</span>
          <span>8× replay · {progress}%</span>
        </div>
      )}
    </div>
  )
}
