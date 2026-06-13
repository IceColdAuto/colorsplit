/**
 * Gallery — persists completed artworks in localStorage (demo) or Firebase (production).
 * Each artwork stores: id, completedAt, pageId, mode, players, finalImageUrl, strokes[]
 */

const KEY = 'colorsplit_gallery_v3'
const MAX_ARTWORKS = 40
const MAX_STROKES_PER_ARTWORK = 400

/**
 * Re-encode a PNG data URL as a JPEG on a white background.
 * A full-res 800×800 PNG can exceed 1 MB; the JPEG lands around 100–200 KB,
 * which is what makes a multi-artwork localStorage gallery viable at all.
 * Returns the original URL if anything fails (e.g. canvas tainted).
 */
export function compressImageDataUrl(dataUrl, size = 800, quality = 0.85) {
  return new Promise(resolve => {
    if (!dataUrl) { resolve(dataUrl); return }
    const img = new Image()
    img.onload = () => {
      try {
        const c = document.createElement('canvas')
        c.width = size
        c.height = size
        const ctx = c.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, size, size)
        ctx.drawImage(img, 0, 0, size, size)
        resolve(c.toDataURL('image/jpeg', quality))
      } catch {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

/**
 * Saves an artwork entry. Returns { ok, entry }: ok=false means localStorage
 * rejected every attempt (quota), so callers can tell the user instead of
 * silently dropping the artwork.
 *
 * Entry fields beyond the original schema:
 *   savedByPlayerId — local player at save time, for "Made by you" labels
 *   status          — 'completed' | 'completed_after_leave'
 *   leftPlayerIds   — players who had left before completion
 *   localOwnerType  — 'guest' | 'user': who was using the device at save time
 *   localOwnerId    — guest player id or account uid matching localOwnerType
 *   migratedToUid   — account this entry was copied to (never offered again)
 *   migratedAt      — when that copy happened
 *   cloudArtworkId  — id of the cloud copy, for dedupe across id schemes
 */
export function saveArtwork(artwork) {
  const gallery = loadGallery()

  // Limit allStrokes total count for localStorage safety
  let savedAllStrokes = null
  if (artwork.allStrokes) {
    let total = 0
    const limited = {}
    for (const [pid, pStrokes] of Object.entries(artwork.allStrokes)) {
      if (total >= MAX_STROKES_PER_ARTWORK) break
      limited[pid] = {}
      for (const [sid, stroke] of Object.entries(pStrokes || {})) {
        if (total >= MAX_STROKES_PER_ARTWORK) break
        limited[pid][sid] = stroke
        total++
      }
    }
    savedAllStrokes = limited
  }

  const entry = {
    // Unique per completion: the same room played twice produces two artworks.
    id: artwork.id || `${artwork.code || 'x'}_${artwork.completedAt || Date.now()}`,
    code: artwork.code || '',
    name: artwork.name || 'My Artwork',
    completedAt: artwork.completedAt || Date.now(),
    pageId: artwork.pageId || '',
    mode: artwork.mode || 'solo',
    players: artwork.players || [],
    savedByPlayerId: artwork.savedByPlayerId || null,
    status: artwork.status || 'completed',
    leftPlayerIds: artwork.leftPlayerIds || [],
    finalImageUrl: artwork.finalImageUrl || null,
    strokes: (artwork.strokes || []).slice(0, MAX_STROKES_PER_ARTWORK),
    allStrokes: savedAllStrokes,
    tearLine: artwork.tearLine || null,
    localOwnerType: artwork.localOwnerType || 'guest',
    localOwnerId: artwork.localOwnerId || null,
    migratedToUid: artwork.migratedToUid || null,
    migratedAt: artwork.migratedAt || null,
    cloudArtworkId: artwork.cloudArtworkId || null,
  }

  // Replace existing entry with same id, otherwise prepend
  const filtered = gallery.filter(a => a.id !== entry.id)
  filtered.unshift(entry)
  if (filtered.length > MAX_ARTWORKS) filtered.length = MAX_ARTWORKS

  // Quota fallbacks, most valuable data last to go:
  // full list → drop replay strokes of older artworks → drop oldest half → newest only
  const attempts = [
    filtered,
    filtered.map((a, i) => i === 0 ? a : { ...a, strokes: [], allStrokes: null }),
    filtered.slice(0, Math.max(1, Math.floor(filtered.length / 2)))
      .map((a, i) => i === 0 ? a : { ...a, strokes: [], allStrokes: null }),
    [entry],
  ]
  for (const attempt of attempts) {
    try {
      localStorage.setItem(KEY, JSON.stringify(attempt))
      return { ok: true, entry }
    } catch {}
  }
  return { ok: false, entry }
}

export function loadGallery() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}

export function getArtwork(id) {
  return loadGallery().find(a => a.id === id) || null
}

export function deleteArtwork(id) {
  const gallery = loadGallery().filter(a => a.id !== id)
  localStorage.setItem(KEY, JSON.stringify(gallery))
}

// Stamp a local entry as copied to an account. A stamped entry is never
// offered for migration again — not even to a different account on the same
// device. The replay data stays untouched.
export function markArtworkMigrated(id, uid, cloudArtworkId = null) {
  const gallery = loadGallery()
  const entry = gallery.find(a => a.id === id)
  if (!entry) return
  entry.migratedToUid = uid
  entry.migratedAt = Date.now()
  if (cloudArtworkId) entry.cloudArtworkId = cloudArtworkId
  try { localStorage.setItem(KEY, JSON.stringify(gallery)) } catch {}
}

export function hasReplayData(entry) {
  return (entry?.strokes?.length > 0) || (entry?.mode === 'tear' && !!entry?.allStrokes)
}

// Two entries describe the same finished artwork when their ids (or recorded
// cloud-copy ids) match, or — for entries saved before canonical ids existed —
// when they come from the same session round: same room code and page,
// completed within minutes of each other. Multiplayer saves of one round land
// seconds apart; a "Play Again" round needs longer than the window to color.
const SAME_ROUND_WINDOW_MS = 10 * 60 * 1000

export function isSameArtwork(a, b) {
  if (!a || !b) return false
  if (a.id && a.id === b.id) return true
  if (a.cloudArtworkId && a.cloudArtworkId === b.id) return true
  if (b.cloudArtworkId && b.cloudArtworkId === a.id) return true
  const codeA = a.code || a.sessionCode || ''
  const codeB = b.code || b.sessionCode || ''
  return !!codeA && codeA === codeB &&
    (a.pageId || '') === (b.pageId || '') &&
    Math.abs((a.completedAt || 0) - (b.completedAt || 0)) < SAME_ROUND_WINDOW_MS
}

/**
 * Merge local and cloud galleries into one visible list with exactly one card
 * per finished artwork. Preference within a duplicate group:
 *   1. an entry with replay data (always local — the cloud stores none)
 *   2. neither has replay → the cloud copy (it's the persistent one)
 *   3. both cloud → newest
 * Nothing is deleted here — hidden duplicates stay in their stores.
 */
export function mergeGalleries(localEntries, cloudEntries) {
  const kept = [...localEntries]
  for (const cloud of cloudEntries) {
    const i = kept.findIndex(k => isSameArtwork(k, cloud))
    if (i === -1) { kept.push(cloud); continue }
    const existing = kept[i]
    if (hasReplayData(existing)) continue
    if (!existing.cloud) { kept[i] = cloud; continue } // local without replay loses to persistent cloud
    if ((cloud.completedAt || 0) > (existing.completedAt || 0)) kept[i] = cloud
  }
  return kept.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
}

export function clearGallery() {
  localStorage.removeItem(KEY)
}

// Palette challenge: pick 5 visually distinct colors from the pool
const PALETTE_POOL = [
  '#E03232', '#FF6B8A', '#C44569',
  '#F97316', '#FF9F43', '#E67E22',
  '#F1C40F', '#FECA57', '#D4AC0D',
  '#27AE60', '#1DD1A1', '#6AB04C',
  '#3498DB', '#48DBFB', '#0652DD',
  '#8E44AD', '#9980FA', '#5F27CD',
  '#D35400', '#16A085', '#2C3E50',
]

export function generatePalette(n = 5) {
  const pool = [...PALETTE_POOL].sort(() => Math.random() - 0.5)
  return pool.slice(0, n)
}
