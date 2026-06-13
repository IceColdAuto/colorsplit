// Material sounds + haptics for coloring tools.
//
// Sound design goals: soft, calming, realistic — never static-like.
// - Pink noise base (white noise is harsh), shaped by 2 filters per material.
// - One audio "voice" per stroke; gain follows smoothed drawing speed via
//   setTargetAtTime, so sound swells with movement and dies away when the
//   pointer holds still. No per-pixel triggering, no source restarts.
// - Slow amplitude wobble for waxy/rubbery materials (crayon, eraser).
// - DynamicsCompressor + low master cap so it can never get loud.
//
// All work in the pointer-move path is a few float ops + WebAudio parameter
// automation — no allocation, no graph rebuilding — so drawing never lags.

const SETTINGS_KEY = 'colorsplit_soundfeel_v2' // v2: sounds default OFF

const DEFAULTS = { sounds: false, haptics: true, volume: 'medium' }

// Hard ceiling is intentionally very low — relaxing, not noticeable.
const VOLUME_LEVELS = { low: 0.02, medium: 0.05, high: 0.1 }

export function getSoundFeel() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSoundFeel(settings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch {}
}

// ─── Material profiles ────────────────────────────────────────────────────────
// filters: chained BiquadFilters that shape the pink noise.
// level: per-material loudness (≤1, relative to the master cap).
// rate: playback rate of the noise loop (lower = darker/duller).
// wobble: slow AM depth/frequency for tactile rubbing textures.

const PROFILES = {
  // soft paper scratch, dry and light
  pencil: {
    filters: [
      { type: 'bandpass', freq: 2600, q: 0.4 },
      { type: 'lowpass', freq: 5200, q: 0.3 },
    ],
    level: 0.55, rate: 1.0, wobble: null,
  },
  // slightly grainier paper texture
  coloredPencil: {
    filters: [
      { type: 'bandpass', freq: 1900, q: 0.6 },
      { type: 'lowpass', freq: 4200, q: 0.3 },
    ],
    level: 0.6, rate: 0.95, wobble: { freq: 22, depth: 0.18 },
  },
  // warm waxy rubbing
  crayon: {
    filters: [
      { type: 'bandpass', freq: 520, q: 0.7 },
      { type: 'lowpass', freq: 1600, q: 0.4 },
    ],
    level: 0.7, rate: 0.7, wobble: { freq: 11, depth: 0.3 },
  },
  // smooth, soft, almost silent
  marker: {
    filters: [
      { type: 'lowpass', freq: 700, q: 0.3 },
      { type: 'lowpass', freq: 1400, q: 0.3 },
    ],
    level: 0.22, rate: 0.8, wobble: null,
  },
  // dull rubber rubbing
  eraser: {
    filters: [
      { type: 'lowpass', freq: 420, q: 0.5 },
      { type: 'lowpass', freq: 900, q: 0.3 },
    ],
    level: 0.6, rate: 0.65, wobble: { freq: 6.5, depth: 0.28 },
  },
}

let ctx = null
let noiseBuffer = null
let masterGain = null
let voice = null // per-stroke: { source, gain, lfo, lfoGain, level }

// Movement tracking for the speed→intensity envelope
let lastPt = null
let lastMoveTime = 0
let smoothSpeed = 0

function ensureAudio() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()

  // 2s pink-noise loop (Paul Kellet approximation) — much softer than white.
  const len = ctx.sampleRate * 2
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = noiseBuffer.getChannelData(0)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + white * 0.0555179
    b1 = 0.99332 * b1 + white * 0.0750759
    b2 = 0.969 * b2 + white * 0.153852
    b3 = 0.8665 * b3 + white * 0.3104856
    b4 = 0.55 * b4 + white * 0.5329522
    b5 = -0.7616 * b5 - white * 0.016898
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
    b6 = white * 0.115926
  }

  masterGain = ctx.createGain()
  masterGain.gain.value = VOLUME_LEVELS[getSoundFeel().volume] ?? VOLUME_LEVELS.medium

  // Gentle safety compressor — smooths any peak, guarantees the low cap holds.
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -32
  limiter.knee.value = 18
  limiter.ratio.value = 6
  limiter.attack.value = 0.005
  limiter.release.value = 0.18

  masterGain.connect(limiter)
  limiter.connect(ctx.destination)
  return ctx
}

export function applyVolumeSetting(volume) {
  if (masterGain) masterGain.gain.value = VOLUME_LEVELS[volume] ?? VOLUME_LEVELS.medium
}

export function startMaterialSound(tool) {
  const settings = getSoundFeel()
  if (!settings.sounds) return
  if (!ensureAudio()) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  stopMaterialSound(true)

  const profile = PROFILES[tool] || PROFILES.pencil

  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer
  source.loop = true
  // small random pitch variation per stroke so strokes never sound identical
  source.playbackRate.value = profile.rate * (0.94 + Math.random() * 0.12)

  let node = source
  for (const f of profile.filters) {
    const filter = ctx.createBiquadFilter()
    filter.type = f.type
    filter.frequency.value = f.freq * (0.92 + Math.random() * 0.16)
    filter.Q.value = f.q
    node.connect(filter)
    node = filter
  }

  const gain = ctx.createGain()
  gain.gain.value = 0 // starts silent; movement drives it up (smooth fade-in)
  node.connect(gain)

  // Slow amplitude wobble = tactile rubbing texture (crayon/eraser/grain)
  let lfo = null, lfoGain = null
  if (profile.wobble) {
    const wobbleGain = ctx.createGain()
    wobbleGain.gain.value = 1 - profile.wobble.depth
    lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = profile.wobble.freq * (0.85 + Math.random() * 0.3)
    lfoGain = ctx.createGain()
    lfoGain.gain.value = profile.wobble.depth
    lfo.connect(lfoGain)
    lfoGain.connect(wobbleGain.gain)
    gain.connect(wobbleGain)
    wobbleGain.connect(masterGain)
    lfo.start()
  } else {
    gain.connect(masterGain)
  }

  source.start(0, Math.random() * noiseBuffer.duration)
  voice = { source, gain, lfo, level: profile.level }
  lastPt = null
  smoothSpeed = 0
}

// Called from the pointer-move path. Maps smoothed drawing speed to loudness:
// slow movement = softer, faster = slightly stronger. Also pre-schedules a
// decay so the sound melts away (~150ms) whenever movement stops — no timers.
export function updateMaterialSound(pt) {
  if (!voice || !ctx) return
  const now = performance.now()
  if (lastPt) {
    const dt = Math.max(8, now - lastMoveTime)
    const dist = Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y)
    // exponential smoothing keeps the envelope stable, no zipper noise
    smoothSpeed = smoothSpeed * 0.72 + (dist / dt) * 0.28
  }
  lastPt = pt
  lastMoveTime = now

  const v = Math.min(1, smoothSpeed / 1.3) // ~1.3 canvas-px/ms = "fast"
  const intensity = (0.15 + 0.85 * Math.pow(v, 0.8)) * voice.level
  const t = ctx.currentTime
  const g = voice.gain.gain
  g.cancelScheduledValues(t)
  g.setTargetAtTime(intensity, t, 0.05)      // smooth follow while moving
  g.setTargetAtTime(0.0001, t + 0.13, 0.07)  // auto-fade if no more movement
}

export function stopMaterialSound(immediate = false) {
  if (!voice || !ctx) return
  const { source, gain, lfo } = voice
  voice = null
  lastPt = null
  smoothSpeed = 0
  try {
    if (immediate) {
      source.stop()
      lfo?.stop()
    } else {
      // smooth fade-out, never a click
      const t = ctx.currentTime
      gain.gain.cancelScheduledValues(t)
      gain.gain.setTargetAtTime(0.0001, t, 0.05)
      source.stop(t + 0.3)
      lfo?.stop(t + 0.3)
    }
  } catch {}
}

// Tiny tap when a stroke begins. navigator.vibrate is unsupported on iOS
// Safari — the call is simply a no-op there.
export function strokeHaptic() {
  if (!getSoundFeel().haptics) return
  try { navigator.vibrate?.(8) } catch {}
}

// Debug hook for development verification only.
if (import.meta.env?.DEV && typeof window !== 'undefined') {
  window.__soundFeelDebug = {
    getState: () => ({
      hasVoice: !!voice,
      smoothSpeed,
      gainValue: voice ? voice.gain.gain.value : null,
      masterCap: masterGain ? masterGain.gain.value : null,
      ctxState: ctx?.state ?? 'none',
    }),
  }
}
