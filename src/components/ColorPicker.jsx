import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

// Convert HSB (h:0-360, s:0-100, b:0-100) → #rrggbb
function hsbToHex(h, s, b) {
  s /= 100; b /= 100
  const k = n => (n + h / 60) % 6
  const f = n => b - b * s * Math.max(0, Math.min(k(n), 4 - k(n), 1))
  const hex = x => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${hex(f(5))}${hex(f(3))}${hex(f(1))}`
}

function hexToHsb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h = Math.round(h * 60)
    if (h < 0) h += 360
  }
  return { h, s: max ? Math.round((d / max) * 100) : 0, b: Math.round(max * 100) }
}

const PRESETS = [
  '#E03232', '#F97316', '#F5C518', '#22C55E',
  '#3B82F6', '#8B5CF6', '#EC4899', '#000000',
  '#FFFFFF', '#A78BFA', '#34D399', '#FB923C',
]

const WHEEL_R = 96   // radius of hue wheel center
const WHEEL_TRACK = 18

export default function ColorPicker({ currentColor, opacity, onColorChange, onColorCommit, onOpacityChange, onClose }) {
  const [hsb, setHsb] = useState(() => hexToHsb(currentColor || '#3B82F6'))
  const [localOpacity, setLocalOpacity] = useState(Math.round(opacity * 100))
  const wheelRef = useRef(null)
  const sbRef = useRef(null)
  const activeZone = useRef(null)  // 'wheel' | 'sb' | null

  const SIZE = (WHEEL_R + WHEEL_TRACK) * 2 + 4   // total wheel SVG size
  const SB = 130                                   // saturation-brightness box size

  // Update color from HSB state
  const emitColor = useCallback((newHsb) => {
    onColorChange(hsbToHex(newHsb.h, newHsb.s, newHsb.b))
  }, [onColorChange])

  // Compute hue from pointer position on wheel
  function hueFromPointer(e, el) {
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const touch = e.touches ? e.touches[0] : e
    const angle = Math.atan2(touch.clientY - cy, touch.clientX - cx) * (180 / Math.PI)
    return ((angle % 360) + 360) % 360
  }

  // Minimum brightness from the SB box so a stray drag to the bottom edge
  // (common on small mobile touch targets) can't silently flood a section with
  // pure #000000. Pure black is still reachable via the explicit black preset.
  const MIN_SB_BRIGHTNESS = 8

  // Compute saturation+brightness from pointer in SB box
  function sbFromPointer(e, el) {
    const rect = el.getBoundingClientRect()
    const touch = e.touches ? e.touches[0] : e
    const x = Math.max(0, Math.min(SB, touch.clientX - rect.left))
    const y = Math.max(0, Math.min(SB, touch.clientY - rect.top))
    const b = Math.round(100 - (y / SB) * 100)
    return { s: Math.round((x / SB) * 100), b: Math.max(MIN_SB_BRIGHTNESS, b) }
  }

  function handleWheelEvent(e) {
    if (!wheelRef.current) return
    const h = Math.round(hueFromPointer(e, wheelRef.current))
    const next = { ...hsb, h }
    setHsb(next)
    emitColor(next)
  }

  function handleSBEvent(e) {
    if (!sbRef.current) return
    const { s, b } = sbFromPointer(e, sbRef.current)
    const next = { ...hsb, s, b }
    setHsb(next)
    emitColor(next)
  }

  // Unified pointer-down on either zone — immediately update on first click
  function handlePointerDown(zone, e) {
    e.preventDefault()
    activeZone.current = zone
    if (zone === 'wheel') handleWheelEvent(e)
    else handleSBEvent(e)
  }

  function handlePointerMove(e) {
    if (!activeZone.current) return
    e.preventDefault()
    if (activeZone.current === 'wheel') handleWheelEvent(e)
    else handleSBEvent(e)
  }

  function handlePointerUp() {
    if (activeZone.current) {
      // Drag ended — commit the final color to recents.
      onColorCommit?.(hsbToHex(hsb.h, hsb.s, hsb.b))
    }
    activeZone.current = null
  }

  useEffect(() => {
    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    window.addEventListener('touchmove', handlePointerMove, { passive: false })
    window.addEventListener('touchend', handlePointerUp)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
      window.removeEventListener('touchmove', handlePointerMove)
      window.removeEventListener('touchend', handlePointerUp)
    }
  }, [hsb])   // re-register when hsb changes so closures are fresh

  // Wheel cursor
  const hRad = (hsb.h * Math.PI) / 180
  const wheelMid = WHEEL_R + WHEEL_TRACK + 2
  const cursorR = WHEEL_R + WHEEL_TRACK / 2
  const wx = wheelMid + cursorR * Math.cos(hRad)
  const wy = wheelMid + cursorR * Math.sin(hRad)

  // SB cursor
  const sbX = (hsb.s / 100) * SB
  const sbY = ((100 - hsb.b) / 100) * SB

  function handleOpacityChange(val) {
    setLocalOpacity(val)
    onOpacityChange(val / 100)
  }

  const currentHex = hsbToHex(hsb.h, hsb.s, hsb.b)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        onClick={e => e.stopPropagation()}
        className="bg-cream w-full max-w-lg rounded-t-3xl p-5 pb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl text-ink" style={{ fontFamily: "'Fredoka One', cursive" }}>
            Pick a color
          </h3>
          <button onClick={onClose} className="text-ink/40 font-semibold font-body text-sm active:scale-90 transition-transform">
            Done
          </button>
        </div>

        <div className="flex gap-4 justify-center items-start mb-5">
          {/* Hue wheel */}
          <div className="relative select-none flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
            <svg
              ref={wheelRef}
              width={SIZE}
              height={SIZE}
              style={{ display: 'block', cursor: 'crosshair' }}
              onMouseDown={e => handlePointerDown('wheel', e)}
              onTouchStart={e => handlePointerDown('wheel', e)}
            >
              {/* Hue ring */}
              {Array.from({ length: 360 }, (_, i) => {
                const a1 = (i * Math.PI) / 180
                const a2 = ((i + 1.5) * Math.PI) / 180
                const ro = WHEEL_R + WHEEL_TRACK - 1, ri = WHEEL_R + 1
                const x1 = wheelMid + ro * Math.cos(a1), y1 = wheelMid + ro * Math.sin(a1)
                const x2 = wheelMid + ro * Math.cos(a2), y2 = wheelMid + ro * Math.sin(a2)
                const x3 = wheelMid + ri * Math.cos(a2), y3 = wheelMid + ri * Math.sin(a2)
                const x4 = wheelMid + ri * Math.cos(a1), y4 = wheelMid + ri * Math.sin(a1)
                return <polygon key={i} points={`${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}`} fill={`hsl(${i},100%,50%)`} />
              })}
              {/* Cursor on wheel */}
              <circle cx={wx} cy={wy} r={WHEEL_TRACK / 2 - 1} fill={`hsl(${hsb.h},100%,50%)`} stroke="white" strokeWidth="2.5" />
            </svg>
          </div>

          {/* SB box + preview */}
          <div className="flex flex-col gap-2">
            <div
              ref={sbRef}
              className="relative rounded-xl overflow-hidden select-none"
              style={{ width: SB, height: SB, cursor: 'crosshair' }}
              onMouseDown={e => handlePointerDown('sb', e)}
              onTouchStart={e => handlePointerDown('sb', e)}
            >
              <div className="absolute inset-0" style={{ background: `hsl(${hsb.h},100%,50%)` }} />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to right,white,transparent)' }} />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom,transparent,black)' }} />
              {/* Cursor */}
              <div
                className="absolute w-4 h-4 rounded-full border-2 border-white shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: sbX, top: sbY, background: currentHex }}
              />
            </div>

            {/* Preview + hex */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl border border-ink/15 flex-shrink-0" style={{ background: currentHex }} />
              <span className="text-ink/50 font-body text-xs font-mono">{currentHex.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Opacity slider */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-ink/40 text-xs uppercase tracking-wider font-body w-20 flex-shrink-0">Opacity</span>
          <input
            type="range" min={10} max={100} value={localOpacity}
            onChange={e => handleOpacityChange(+e.target.value)}
            className="flex-1 accent-blue-500"
          />
          <span className="text-ink/60 text-sm font-semibold font-body w-10 text-right">{localOpacity}%</span>
        </div>

        {/* Preset swatches */}
        <div className="grid grid-cols-6 gap-2">
          {PRESETS.map(c => (
            <button
              key={c}
              onClick={() => { const n = hexToHsb(c); setHsb(n); onColorCommit?.(c) ?? onColorChange(c) }}
              className={`aspect-square rounded-xl border transition-all active:scale-90 ${
                currentHex.toLowerCase() === c.toLowerCase() ? 'ring-2 ring-blue-500 ring-offset-1 border-transparent' : 'border-ink/10'
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
