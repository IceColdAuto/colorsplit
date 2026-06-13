// Shareable reveal video — ONE normal coloring page, start to finish.
//
// Narrative (always, regardless of solo / together / tear session):
//   1. INTRO     — white canvas with only the black coloring-page lines.
//   2. TIMELAPSE — the strokes fill the page in over time (empty → filled).
//   3. FINAL     — the complete captured artwork, with a small watermark.
//
// No split/tear visuals, no separated halves, no dark background, no seam, and
// it never opens on the finished result. Tear sessions are flattened: all
// players' strokes are merged into one chronological timeline and drawn onto a
// single canvas, so the video looks like one normal coloring page being filled.
//
// Rendered offscreen and recorded with captureStream() + MediaRecorder.

import { drawStroke } from './canvasUtils'

const SIZE = 800
const FPS = 30

const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const clamp01 = t => Math.max(0, Math.min(1, t))

export function isRevealVideoSupported() {
  return !!pickMimeType() && 'captureStream' in HTMLCanvasElement.prototype && !!window.MediaRecorder
}

function pickMimeType() {
  const candidates = [
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ]
  for (const m of candidates) {
    if (window.MediaRecorder?.isTypeSupported?.(m)) return m
  }
  return ''
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function makeCanvas() {
  const c = document.createElement('canvas')
  c.width = SIZE; c.height = SIZE
  return c
}

async function loadContour(colorPage) {
  if (!colorPage) return null
  let img
  if (colorPage.svgContent) {
    const blob = new Blob([colorPage.svgContent], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    try { img = await loadImage(url) } finally { URL.revokeObjectURL(url) }
  } else if (colorPage.uploadDataUrl || colorPage.imageUrl) {
    img = await loadImage(colorPage.uploadDataUrl || colorPage.imageUrl)
  } else {
    return null
  }
  const c = makeCanvas()
  c.getContext('2d').drawImage(img, 0, 0, SIZE, SIZE)
  return c
}

// Merge every player's strokes into one chronological list (tear or together),
// or use the already-flat solo list. Returns an array of stroke objects.
function flattenStrokes({ allStrokes, strokes }) {
  if (Array.isArray(strokes) && strokes.length) {
    return [...strokes].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
  }
  const flat = []
  for (const playerStrokes of Object.values(allStrokes || {})) {
    for (const s of Object.values(playerStrokes || {})) {
      if (s?.points?.length) flat.push(s)
    }
  }
  return flat.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
}

function drawWatermark(ctx, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'
  ctx.lineWidth = 4
  ctx.font = 'bold 34px sans-serif'
  ctx.textAlign = 'center'
  const y = SIZE - 36
  ctx.strokeText('Made with ColorSplit 🎨', SIZE / 2, y)
  ctx.fillText('Made with ColorSplit 🎨', SIZE / 2, y)
  ctx.restore()
}

function drawContour(ctx, contour) {
  if (!contour) return
  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(contour, 0, 0)
  ctx.restore()
}

// Builds the offscreen scene and returns { stage, render(t), TOTAL }.
// Shared by the recorder and the dev-only frame sampler so they stay in sync.
async function buildScene({ allStrokes, strokes, colorPage, finalImageUrl }) {
  const finalImg = await loadImage(finalImageUrl)
  const contour = await loadContour(colorPage)

  const list = flattenStrokes({ allStrokes, strokes })
  // "Enough" stroke data to make a real timelapse; otherwise use the fallback.
  const hasStrokes = list.length >= 2

  // Pre-accumulate strokes incrementally on one canvas.
  const fillCanvas = makeCanvas()
  const fillCtx = fillCanvas.getContext('2d')
  let drawnUpTo = 0

  const stage = makeCanvas()
  const ctx = stage.getContext('2d')

  // ── Timeline (seconds) ──────────────────────────────────────────────────────
  const INTRO = 0.9
  const TIMELAPSE = 3.8
  const FINAL = 1.6
  const TOTAL = INTRO + TIMELAPSE + FINAL

  function whiteBase() {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, SIZE, SIZE)
  }

  function drawTimelapse(progress) {
    whiteBase()
    if (hasStrokes) {
      // advance the accumulated fill canvas to the target stroke count
      const target = Math.floor(easeInOut(progress) * list.length)
      while (drawnUpTo < target) {
        drawStroke(fillCtx, list[drawnUpTo])
        drawnUpTo++
      }
      ctx.drawImage(fillCanvas, 0, 0)
    } else {
      // Fallback: no usable stroke data — fade the final colors in gradually so
      // it still builds up from empty (never a straight cut to the result).
      const steps = 6
      const a = easeInOut(clamp01(progress))
      ctx.save()
      ctx.globalAlpha = Math.round(a * steps) / steps // stepped fade-in
      ctx.drawImage(finalImg, 0, 0, SIZE, SIZE)
      ctx.restore()
    }
    drawContour(ctx, contour)
  }

  function render(t) {
    // 1. INTRO — empty coloring page (line art only)
    if (t < INTRO) {
      whiteBase()
      drawContour(ctx, contour)
      return
    }
    // 2. TIMELAPSE — fill in over time
    const t2 = t - INTRO
    if (t2 < TIMELAPSE) {
      drawTimelapse(clamp01(t2 / TIMELAPSE))
      return
    }
    // 3. FINAL — the complete captured artwork + watermark
    const t3 = t2 - TIMELAPSE
    whiteBase()
    const pop = t3 < 0.4 ? 1 + 0.03 * Math.sin((t3 / 0.4) * Math.PI) : 1
    ctx.save()
    ctx.translate(SIZE / 2, SIZE / 2)
    ctx.scale(pop, pop)
    ctx.drawImage(finalImg, -SIZE / 2, -SIZE / 2, SIZE, SIZE)
    ctx.restore()
    drawWatermark(ctx, clamp01((t3 - 0.2) / 0.5))
  }

  return { stage, render, TOTAL }
}

/**
 * @param {object} opts
 * @param {object|null} opts.allStrokes   tear/together: { [pid]: { [sid]: stroke } }
 * @param {Array}       opts.strokes      solo: flat stroke array (optional)
 * @param {object|null} opts.colorPage
 * @param {string}      opts.finalImageUrl PNG data URL of the finished artwork
 * @param {function}    [opts.onProgress] 0..1
 */
export async function generateRevealVideo({ allStrokes, strokes, colorPage, finalImageUrl, onProgress }) {
  const mimeType = pickMimeType()
  if (!mimeType || !('captureStream' in HTMLCanvasElement.prototype) || !window.MediaRecorder) {
    throw new Error('unsupported')
  }

  const { stage, render, TOTAL } = await buildScene({ allStrokes, strokes, colorPage, finalImageUrl })

  // ── Record ─────────────────────────────────────────────────────────────────
  render(0)
  const stream = stage.captureStream(FPS)
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 })
  const chunks = []
  recorder.ondataavailable = e => { if (e.data?.size) chunks.push(e.data) }
  const done = new Promise((resolve, reject) => {
    recorder.onstop = () => resolve()
    recorder.onerror = e => reject(e.error || new Error('recording failed'))
  })

  recorder.start(250)
  const start = performance.now()
  await new Promise(resolve => {
    function tick() {
      const t = (performance.now() - start) / 1000
      if (t >= TOTAL) { resolve(); return }
      render(t)
      onProgress?.(clamp01(t / TOTAL))
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  // hold the final frame briefly so the recording doesn't cut on the last paint
  render(TOTAL - 0.001)
  await new Promise(r => setTimeout(r, 120))
  recorder.stop()
  await done
  onProgress?.(1)

  const blob = new Blob(chunks, { type: mimeType.split(';')[0] })
  const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'
  return { blob, mimeType: mimeType.split(';')[0], ext }
}

// Share the video natively where supported; otherwise download it.
// Returns 'shared' | 'downloaded'.
export async function shareOrDownloadVideo({ blob, mimeType, ext }, code) {
  const file = new File([blob], `colorsplit-reveal-${code}.${ext}`, { type: mimeType })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title: 'Our ColorSplit reveal! 🎨', files: [file] })
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'shared' // user closed the sheet
    }
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = file.name
  link.href = url
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}

// Fallback when video generation isn't supported: share/download the final
// still image instead. Returns 'shared' | 'downloaded'.
export async function shareOrDownloadImage(dataUrl, code) {
  try {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const file = new File([blob], `colorsplit-${code}.png`, { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: 'My ColorSplit artwork! 🎨', files: [file] })
        return 'shared'
      } catch (e) {
        if (e?.name === 'AbortError') return 'shared'
      }
    }
  } catch {}
  const link = document.createElement('a')
  link.download = `colorsplit-${code}.png`
  link.href = dataUrl
  link.click()
  return 'downloaded'
}

// Dev-only verification helper: renders the scene at given normalised times
// (0..1 of TOTAL) and returns the share of non-white pixels at each, so a test
// can assert the video starts empty and builds up to filled. Not used in prod.
export async function __sampleRevealFrames(opts, fractions = [0, 0.3, 0.6, 1]) {
  const { stage, render, TOTAL } = await buildScene(opts)
  const ctx = stage.getContext('2d')
  return fractions.map(f => {
    const t = Math.min(TOTAL - 0.001, Math.max(0, f * TOTAL))
    render(t)
    const data = ctx.getImageData(0, 0, SIZE, SIZE).data
    let colored = 0, dark = 0
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2]
      if (!(r > 245 && g > 245 && b > 245)) colored++
      if (r < 60 && g < 60 && b < 60) dark++
    }
    const total = SIZE * SIZE
    return { f, coloredRatio: +(colored / total).toFixed(4), darkRatio: +(dark / total).toFixed(4) }
  })
}
