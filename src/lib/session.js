import { db, storage, DEMO_MODE } from './firebase'
import { ref, set, get, update, push, onValue, off, onDisconnect } from 'firebase/database'
import { ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage'
import { v4 as uuidv4 } from 'uuid'

// ─── In-memory store for demo mode ───────────────────────────────────────────

const memStore = {}
const memListeners = {}

function memGet(path) {
  const parts = path.split('/')
  let node = memStore
  for (const p of parts) {
    if (!p) continue
    node = node?.[p]
    if (node === undefined) return null
  }
  return node ?? null
}

function memSet(path, value) {
  const parts = path.split('/').filter(Boolean)
  let node = memStore
  for (let i = 0; i < parts.length - 1; i++) {
    if (!node[parts[i]]) node[parts[i]] = {}
    node = node[parts[i]]
  }
  node[parts[parts.length - 1]] = value
  memNotify(path)
}

function memUpdate(path, updates) {
  for (const [k, v] of Object.entries(updates)) {
    memSet(`${path}/${k}`, v)
  }
}

function memPush(path) {
  const id = uuidv4().slice(0, 8)
  return `${path}/${id}`
}

function memDelete(path) {
  const parts = path.split('/').filter(Boolean)
  let node = memStore
  for (let i = 0; i < parts.length - 1; i++) {
    node = node?.[parts[i]]
    if (!node) return
  }
  delete node[parts[parts.length - 1]]
  memNotify(path)
}

function memNotify(changedPath) {
  for (const [listenPath, cbs] of Object.entries(memListeners)) {
    if (changedPath.startsWith(listenPath) || listenPath.startsWith(changedPath)) {
      const val = memGet(listenPath)
      cbs.forEach(cb => cb(val))
    }
  }
}

function memOnValue(path, cb) {
  if (!memListeners[path]) memListeners[path] = []
  memListeners[path].push(cb)
  cb(memGet(path))
  return () => {
    memListeners[path] = memListeners[path].filter(x => x !== cb)
  }
}

// ─── Section normalization ────────────────────────────────────────────────────

// Maps legacy "left"/"right" values to stable zone IDs so older sessions
// (still stored with "left"/"right") keep working alongside new ones.
export function normalizeSection(section) {
  if (section === 'left') return 'zone0'
  if (section === 'right') return 'zone1'
  return section // already a zone ID, null, or unknown — pass through
}

// ─── Public helpers ───────────────────────────────────────────────────────────

export function generateSessionCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export function getOrCreatePlayerId() {
  // localStorage so the ID survives page refresh and iOS Safari tab reloads.
  let id = localStorage.getItem('colorsplit_player_id')
  if (!id) {
    id = uuidv4()
    localStorage.setItem('colorsplit_player_id', id)
  }
  return id
}

export function getOrCreatePlayerName() {
  // Prefer saved profile username
  try {
    const profile = JSON.parse(localStorage.getItem('colorsplit_profile_v1'))
    if (profile?.username?.trim()) return profile.username.trim()
  } catch {}
  let name = sessionStorage.getItem('colorsplit_player_name')
  if (!name) {
    const adj = ['Creative', 'Colorful', 'Dreamy', 'Playful', 'Artistic']
    const noun = ['Panda', 'Fox', 'Owl', 'Star', 'Bunny']
    name = `${adj[Math.floor(Math.random() * adj.length)]} ${noun[Math.floor(Math.random() * noun.length)]}`
    sessionStorage.setItem('colorsplit_player_name', name)
  }
  return name
}

// ─── Active room (for resume after refresh / app close) ──────────────────────

const ACTIVE_ROOM_KEY = 'colorsplit_active_room_v1'

export function setActiveRoom(code, solo = false) {
  try { localStorage.setItem(ACTIVE_ROOM_KEY, JSON.stringify({ code, solo, at: Date.now() })) } catch {}
}

export function getActiveRoom() {
  try {
    const r = JSON.parse(localStorage.getItem(ACTIVE_ROOM_KEY))
    if (!r?.code) return null
    // Rooms older than a day are considered stale
    if (Date.now() - (r.at || 0) > 24 * 60 * 60 * 1000) return null
    return r
  } catch { return null }
}

export function clearActiveRoom() {
  try { localStorage.removeItem(ACTIVE_ROOM_KEY) } catch {}
}

// ─── Presence ─────────────────────────────────────────────────────────────────

// Marks this player as connected and arms an onDisconnect handler so Firebase
// flips `connected` to false when the tab closes or the network drops.
// Returns an unsubscribe that only detaches the listener — it does NOT mark the
// player disconnected, so navigating between screens never flickers presence.
export function setupPresence(code, playerId) {
  if (DEMO_MODE) {
    memSet(`sessions/${code}/players/${playerId}/connected`, true)
    return () => {}
  }
  const connRef = ref(db, '.info/connected')
  const myConnRef = ref(db, `sessions/${code}/players/${playerId}/connected`)
  const lastSeenRef = ref(db, `sessions/${code}/players/${playerId}/lastSeenAt`)
  const unsubscribe = onValue(connRef, snap => {
    if (snap.val() !== true) return
    onDisconnect(myConnRef).set(false)
      .then(() => set(myConnRef, true))
      .catch(() => {})
    onDisconnect(lastSeenRef).set(Date.now()).catch(() => {})
  })
  return unsubscribe
}

// ─── Session CRUD ─────────────────────────────────────────────────────────────

export async function getSession(code) {
  if (DEMO_MODE) return memGet(`sessions/${code}`)
  const snap = await get(ref(db, `sessions/${code}`))
  return snap.exists() ? snap.val() : null
}

export async function createSession(hostId, hostName, solo = false, avatarId = null, colorId = null, uid = null) {
  const code = generateSessionCode()
  const data = {
    status: 'waiting',
    hostId,
    createdAt: Date.now(),
    // Multiplayer defaults to the core ColorSplit concept: color the same
    // page without seeing each other, reveal the combined artwork at the end.
    settings: { mode: solo ? 'solo' : 'tear', visibility: solo ? 'live' : 'reveal', lineHelper: 'correction' },
    coloringPage: null,
    players: {
      [hostId]: { name: hostName, avatarId, colorId, uid, ready: false, done: false, progress: 0, assignedSection: null },
    },
    tearLine: null,
  }

  if (DEMO_MODE) {
    memSet(`sessions/${code}`, data)
  } else {
    await set(ref(db, `sessions/${code}`), data)
  }
  setActiveRoom(code, solo)
  return code
}

export const MAX_PLAYERS = 4

export async function joinSession(code, playerId, playerName, avatarId = null, colorId = null, uid = null) {
  if (DEMO_MODE) {
    const session = memGet(`sessions/${code}`)
    if (!session) throw new Error('Session not found')
    const alreadyIn = !!session.players?.[playerId]
    if (!alreadyIn && session.status !== 'waiting') {
      throw new Error('This round already started. Ask the host to start a new round.')
    }
    const activeCount = Object.values(session.players || {}).filter(p => p.name && !p.left).length
    if (!alreadyIn && activeCount >= MAX_PLAYERS) {
      throw new Error(`This room is full (${MAX_PLAYERS} players max).`)
    }
    if (!alreadyIn) {
      memSet(`sessions/${code}/players/${playerId}`, {
        name: playerName, avatarId, colorId, uid, ready: false, done: false, progress: 0, assignedSection: null,
      })
    }
    setActiveRoom(code, session.settings?.mode === 'solo')
    return session
  }
  const snap = await get(ref(db, `sessions/${code}`))
  if (!snap.exists()) throw new Error('Session not found')
  const session = snap.val()
  const alreadyIn = !!session.players?.[playerId]
  if (!alreadyIn && session.status !== 'waiting') {
    throw new Error('This round already started. Ask the host to start a new round.')
  }
  const activeCount = Object.values(session.players || {}).filter(p => p.name && !p.left).length
  if (!alreadyIn && activeCount >= MAX_PLAYERS) {
    throw new Error(`This room is full (${MAX_PLAYERS} players max).`)
  }
  if (!alreadyIn) {
    await set(ref(db, `sessions/${code}/players/${playerId}`), {
      name: playerName, avatarId, colorId, uid, ready: false, done: false, progress: 0, assignedSection: null,
    })
  }
  setActiveRoom(code, session.settings?.mode === 'solo')
  return session
}

export function subscribeToSession(code, callback) {
  if (DEMO_MODE) return memOnValue(`sessions/${code}`, callback)
  const r = ref(db, `sessions/${code}`)
  onValue(r, snap => callback(snap.val()))
  return () => off(r)
}

export async function updateSessionStatus(code, status) {
  if (DEMO_MODE) { memSet(`sessions/${code}/status`, status); return }
  await update(ref(db, `sessions/${code}`), { status })
}

export async function updateSessionSettings(code, settings) {
  if (DEMO_MODE) { memSet(`sessions/${code}/settings`, settings); return }
  await update(ref(db, `sessions/${code}/settings`), settings)
}

export async function updateColoringPage(code, pageData) {
  if (DEMO_MODE) { memSet(`sessions/${code}/coloringPage`, pageData); return }
  await update(ref(db, `sessions/${code}`), { coloringPage: pageData })
}

export async function setPlayerReady(code, playerId, ready) {
  if (DEMO_MODE) { memSet(`sessions/${code}/players/${playerId}/ready`, ready); return }
  await update(ref(db, `sessions/${code}/players/${playerId}`), { ready })
}

export async function setPlayerDone(code, playerId, done) {
  if (DEMO_MODE) { memSet(`sessions/${code}/players/${playerId}/done`, done); return }
  await update(ref(db, `sessions/${code}/players/${playerId}`), { done })
}

export async function setPlayerWantsAgain(code, playerId, wantsAgain) {
  if (DEMO_MODE) { memSet(`sessions/${code}/players/${playerId}/wantsAgain`, wantsAgain); return }
  await update(ref(db, `sessions/${code}/players/${playerId}`), { wantsAgain })
}

export async function updatePlayerProgress(code, playerId, progress) {
  if (DEMO_MODE) { memSet(`sessions/${code}/players/${playerId}/progress`, progress); return }
  await update(ref(db, `sessions/${code}/players/${playerId}`), { progress })
}

export async function updateRoundController(code, playerId) {
  if (DEMO_MODE) { memSet(`sessions/${code}/roundControllerId`, playerId); return }
  await update(ref(db, `sessions/${code}`), { roundControllerId: playerId })
}

export async function setTearLine(code, tearLine) {
  if (DEMO_MODE) { memSet(`sessions/${code}/tearLine`, tearLine); return }
  await update(ref(db, `sessions/${code}`), { tearLine })
}

export async function setZones(code, zones) {
  if (DEMO_MODE) { memSet(`sessions/${code}/zones`, zones); return }
  await update(ref(db, `sessions/${code}`), { zones })
}

export async function assignSections(code, players) {
  // Only active players get a section — someone who already left must not
  // claim a half of the artwork.
  const playerIds = Object.entries(players || {})
    .filter(([, p]) => p.name && !p.left)
    .map(([pid]) => pid)
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5)
  if (DEMO_MODE) {
    shuffled.forEach((pid, i) => {
      memSet(`sessions/${code}/players/${pid}/assignedSection`, `zone${i}`)
    })
    return
  }
  const updates = {}
  shuffled.forEach((pid, i) => {
    updates[`sessions/${code}/players/${pid}/assignedSection`] = `zone${i}`
  })
  await update(ref(db), updates)
}

export async function addStroke(code, playerId, stroke) {
  if (DEMO_MODE) {
    const id = uuidv4().slice(0, 8)
    memSet(`sessions/${code}/strokes/${playerId}/${id}`, stroke)
    return id
  }
  const strokesRef = ref(db, `sessions/${code}/strokes/${playerId}`)
  const newRef = push(strokesRef)
  await set(newRef, stroke)
  return newRef.key
}

// Remove a single committed stroke (undo). Safe to call with a stale id —
// removing a non-existent key is a no-op in both demo and Firebase modes.
export async function removeStroke(code, playerId, strokeId) {
  if (DEMO_MODE) { memDelete(`sessions/${code}/strokes/${playerId}/${strokeId}`); return }
  await set(ref(db, `sessions/${code}/strokes/${playerId}/${strokeId}`), null)
}

// Re-add a stroke under its original id (redo after undo).
export async function setStrokeWithId(code, playerId, strokeId, stroke) {
  if (DEMO_MODE) { memSet(`sessions/${code}/strokes/${playerId}/${strokeId}`, stroke); return }
  await set(ref(db, `sessions/${code}/strokes/${playerId}/${strokeId}`), stroke)
}

// Replace this player's entire strokes node (reset / undo-of-reset).
// Pass null to clear, or a {strokeId: stroke} map to restore a snapshot.
export async function setMyStrokes(code, playerId, strokesMap) {
  if (DEMO_MODE) {
    if (strokesMap === null) memDelete(`sessions/${code}/strokes/${playerId}`)
    else memSet(`sessions/${code}/strokes/${playerId}`, strokesMap)
    return
  }
  await set(ref(db, `sessions/${code}/strokes/${playerId}`), strokesMap)
}

export function subscribeToStrokes(code, playerId, callback) {
  if (DEMO_MODE) return memOnValue(`sessions/${code}/strokes/${playerId}`, callback)
  const r = ref(db, `sessions/${code}/strokes/${playerId}`)
  onValue(r, snap => callback(snap.val() || {}))
  return () => off(r)
}

export async function updateLiveStroke(code, playerId, stroke) {
  if (DEMO_MODE) { memSet(`sessions/${code}/liveStrokes/${playerId}`, stroke); return }
  await set(ref(db, `sessions/${code}/liveStrokes/${playerId}`), stroke)
}

export async function clearLiveStroke(code, playerId) {
  if (DEMO_MODE) { memSet(`sessions/${code}/liveStrokes/${playerId}`, null); return }
  await set(ref(db, `sessions/${code}/liveStrokes/${playerId}`), null)
}

export function subscribeToLiveStrokes(code, playerId, callback) {
  if (DEMO_MODE) return memOnValue(`sessions/${code}/liveStrokes/${playerId}`, callback)
  const r = ref(db, `sessions/${code}/liveStrokes/${playerId}`)
  onValue(r, snap => callback(snap.val()))
  return () => off(r)
}

export async function getAllStrokes(code) {
  if (DEMO_MODE) return memGet(`sessions/${code}/strokes`) || {}
  const snap = await get(ref(db, `sessions/${code}/strokes`))
  return snap.val() || {}
}

// Mark a player as having intentionally left, and mark the room as abandoned.
// The remaining player's subscription detects players[pid].left === true and
// shows a blocking "room ended" overlay.
export async function leaveRoom(code, playerId) {
  clearActiveRoom()
  const now = Date.now()
  if (DEMO_MODE) {
    memSet(`sessions/${code}/players/${playerId}/left`, true)
    memSet(`sessions/${code}/players/${playerId}/leftAt`, now)
    memSet(`sessions/${code}/abandoned`, true)
    memSet(`sessions/${code}/abandonedBy`, playerId)
    memSet(`sessions/${code}/abandonedAt`, now)
    return
  }
  const updates = {
    [`sessions/${code}/players/${playerId}/left`]: true,
    [`sessions/${code}/players/${playerId}/leftAt`]: now,
    [`sessions/${code}/abandoned`]: true,
    [`sessions/${code}/abandonedBy`]: playerId,
    [`sessions/${code}/abandonedAt`]: now,
  }
  await update(ref(db), updates)
}

// ─── Storage snapshot helpers ─────────────────────────────────────────────────

export async function uploadPlayerSnapshot(code, playerId, dataUrl) {
  const path = `sessionSnapshots/${code}/${playerId}.jpg`
  const fileRef = storageRef(storage, path)
  await uploadString(fileRef, dataUrl, 'data_url', { contentType: 'image/jpeg' })
  return getDownloadURL(fileRef)
}

export async function setPlayerSnapshotUrl(code, playerId, url) {
  await update(ref(db, `sessions/${code}/players/${playerId}`), {
    canvasSnapshotUrl: url,
    snapshotAt: Date.now(),
  })
}

export async function resetRound(code, players) {
  const playerIds = Object.keys(players || {})
  if (DEMO_MODE) {
    memSet(`sessions/${code}/strokes`, null)
    memSet(`sessions/${code}/liveStrokes`, null)
    memSet(`sessions/${code}/tearLine`, null)
    memSet(`sessions/${code}/zones`, null)
    memSet(`sessions/${code}/coloringPage`, null)
    memSet(`sessions/${code}/roundControllerId`, null)
    memSet(`sessions/${code}/status`, 'picking')
    playerIds.forEach(pid => {
      memSet(`sessions/${code}/players/${pid}/done`, false)
      memSet(`sessions/${code}/players/${pid}/ready`, false)
      memSet(`sessions/${code}/players/${pid}/progress`, 0)
      memSet(`sessions/${code}/players/${pid}/assignedSection`, null)
      memSet(`sessions/${code}/players/${pid}/wantsAgain`, null)
    })
    return
  }
  const updates = {
    [`sessions/${code}/strokes`]: null,
    [`sessions/${code}/liveStrokes`]: null,
    [`sessions/${code}/tearLine`]: null,
    [`sessions/${code}/zones`]: null,
    [`sessions/${code}/coloringPage`]: null,
    [`sessions/${code}/roundControllerId`]: null,
    [`sessions/${code}/status`]: 'picking',
  }
  playerIds.forEach(pid => {
    updates[`sessions/${code}/players/${pid}/done`] = false
    updates[`sessions/${code}/players/${pid}/ready`] = false
    updates[`sessions/${code}/players/${pid}/progress`] = 0
    updates[`sessions/${code}/players/${pid}/assignedSection`] = null
    updates[`sessions/${code}/players/${pid}/wantsAgain`] = null
  })
  await update(ref(db), updates)
}
