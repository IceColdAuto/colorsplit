import { useState } from 'react'

const BRUSH_SIZES = [3, 7, 12, 20, 32]
const BRUSH_LABELS = ['XS', 'S', 'M', 'L', 'XL']

export default function Toolbar({
  tool, onToolChange,
  size, onSizeChange,
  color, recentColors,
  onColorClick, onSelectRecentColor,
  onUndo, onRedo, onReset,
}) {
  const [resetArmed, setResetArmed] = useState(false)
  const [showSizePicker, setShowSizePicker] = useState(false)

  function handleReset() {
    if (resetArmed) {
      onReset()
      setResetArmed(false)
    } else {
      setResetArmed(true)
      setTimeout(() => setResetArmed(false), 2200)
    }
  }

  const selectedIdx = BRUSH_SIZES.reduce((best, s, i) =>
    Math.abs(s - size) < Math.abs(BRUSH_SIZES[best] - size) ? i : best, 0)

  const currentDotPx = 5 + selectedIdx * 4

  return (
    <div
      className="bg-cream/95 backdrop-blur-sm border-t border-ink/10 safe-bottom"
      style={{ touchAction: 'manipulation', userSelect: 'none' }}
    >
      {/* Inline size picker — slides in above row 1 when open */}
      {showSizePicker && (
        <div className="flex items-end justify-around px-6 pt-3 pb-2 border-b border-ink/8 bg-white/60">
          {BRUSH_SIZES.map((s, i) => {
            const dotPx = 8 + i * 7  // 8, 15, 22, 29, 36 px
            const isActive = selectedIdx === i
            return (
              <button
                key={s}
                onPointerDown={(e) => {
                  e.preventDefault()
                  onSizeChange(s)
                  setShowSizePicker(false)
                }}
                style={{ touchAction: 'manipulation' }}
                className="flex flex-col items-center gap-1 active:scale-90 transition-transform py-1 px-2"
              >
                <div
                  className="rounded-full transition-all"
                  style={{
                    width: dotPx,
                    height: dotPx,
                    background: isActive ? '#3b82f6' : 'rgba(28,25,23,0.2)',
                    outline: isActive ? '2.5px solid #3b82f6' : '2.5px solid transparent',
                    outlineOffset: 3,
                  }}
                />
                <span
                  className="text-xs font-semibold font-body"
                  style={{ color: isActive ? '#3b82f6' : 'rgba(28,25,23,0.4)' }}
                >
                  {BRUSH_LABELS[i]}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Row 1: kleurenkiezer + penseelknop + recente kleuren */}
      <div className="flex items-center px-4 pt-3 pb-1.5 gap-2">

        {/* Huidige kleur — opent kleurenkiezer */}
        {onColorClick && (
          <button
            onPointerDown={(e) => { e.preventDefault(); onColorClick() }}
            style={{
              touchAction: 'manipulation',
              background: color,
              boxShadow: '0 0 0 2.5px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.12)',
            }}
            className="flex-shrink-0 w-10 h-10 rounded-xl active:scale-90 transition-all overflow-hidden relative"
          >
            <div className="absolute inset-0 opacity-20" style={{ background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }} />
          </button>
        )}

        {/* Penseeldikte-knop — toont huidige dikte, klik opent kiezer */}
        <button
          onPointerDown={(e) => { e.preventDefault(); setShowSizePicker(v => !v) }}
          style={{ touchAction: 'manipulation' }}
          className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90 border-2 ${
            showSizePicker
              ? 'border-blue-400 bg-blue-50'
              : 'border-ink/10 bg-white/60'
          }`}
          title="Penseeldikte"
        >
          <div
            className="rounded-full transition-all"
            style={{
              width: currentDotPx,
              height: currentDotPx,
              background: showSizePicker ? '#3b82f6' : 'rgba(28,25,23,0.55)',
            }}
          />
        </button>

        <div className="w-px h-5 bg-ink/10 flex-shrink-0" />

        {/* Recente kleuren */}
        <div className="flex gap-2 items-center flex-1 overflow-x-auto no-scrollbar">
          {recentColors.slice(0, 7).map((c, i) => (
            <button
              key={c + i}
              onPointerDown={(e) => { e.preventDefault(); onSelectRecentColor(c) }}
              style={{
                touchAction: 'manipulation',
                width: 26,
                height: 26,
                background: c,
                border: c === '#FFFFFF' ? '1px solid rgba(0,0,0,0.15)' : 'none',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                flexShrink: 0,
              }}
              className={`rounded-full transition-all active:scale-90 ${
                color === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : ''
              }`}
            />
          ))}
        </div>
      </div>

      {/* Row 2: gereedschappen */}
      <div className="flex items-center px-3 pb-2.5 gap-1">
        <button
          onPointerDown={(e) => { e.preventDefault(); onUndo() }}
          style={{ touchAction: 'manipulation' }}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-ink/70 active:scale-90 transition-all bg-gray-100 border border-ink/10"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
          </svg>
        </button>
        <button
          onPointerDown={(e) => { e.preventDefault(); onRedo() }}
          style={{ touchAction: 'manipulation' }}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-ink/70 active:scale-90 transition-all bg-gray-100 border border-ink/10"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 7v6h-6"/><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/>
          </svg>
        </button>

        <div className="w-px h-6 bg-ink/10 mx-0.5" />

        <button
          onPointerDown={(e) => { e.preventDefault(); onToolChange('pencil') }}
          style={{ touchAction: 'manipulation' }}
          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90 ${
            tool === 'pencil' ? 'bg-blue-500 text-white shadow-lifted' : 'bg-gray-100 border border-ink/10 text-ink/70'
          }`}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </button>
        <button
          onPointerDown={(e) => { e.preventDefault(); onToolChange('eraser') }}
          style={{ touchAction: 'manipulation' }}
          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90 ${
            tool === 'eraser' ? 'bg-blue-500 text-white shadow-lifted' : 'bg-gray-100 border border-ink/10 text-ink/70'
          }`}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 20H7L3 16l10-10 7 7-2.5 2.5"/>
            <path d="M6 11l6 6"/>
          </svg>
        </button>
        <button
          onPointerDown={(e) => { e.preventDefault(); onToolChange('eyedropper') }}
          style={{ touchAction: 'manipulation' }}
          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90 ${
            tool === 'eyedropper' ? 'bg-blue-500 text-white shadow-lifted' : 'bg-gray-100 border border-ink/10 text-ink/70'
          }`}
          title="Eyedropper — pick a color from your artwork"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m2 22 1-1h3l9-9"/>
            <path d="M3 21v-3l9-9"/>
            <path d="m15 6 3.4-3.4a2.1 2.1 0 0 1 3 3L18 9l.4.4a2.1 2.1 0 0 1 0 3 2.1 2.1 0 0 1-3 0l-3.8-3.8a2.1 2.1 0 0 1 0-3 2.1 2.1 0 0 1 3 0l.4.4Z"/>
          </svg>
        </button>

        <div className="flex-1" />

        <button
          onPointerDown={(e) => { e.preventDefault(); handleReset() }}
          style={{ touchAction: 'manipulation' }}
          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90 ${
            resetArmed ? 'bg-red-500 text-white' : 'text-ink/60'
          }`}
        >
          {resetArmed ? (
            <span className="text-xs font-bold font-body">!</span>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
