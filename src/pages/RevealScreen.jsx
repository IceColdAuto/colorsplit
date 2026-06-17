import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPageById } from '../lib/coloringPages'
import {
  subscribeToSession,
  getOrCreatePlayerId,
  getOrCreatePlayerName,
  setPlayerWantsAgain,
  leaveRoom,
  resetRound,
  createSession,
} from '../lib/session'
import { getProfile } from '../lib/profile'
import { saveArtwork, compressImageDataUrl, markArtworkMigrated, loadGallery } from '../lib/gallery'
import { saveArtworkToCloud } from '../lib/cloudGallery'
import useAuth from '../hooks/useAuth'

const CANVAS_SIZE = 800

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 60)}`))
    img.src = src
  })
}

async function buildColorTogetherImage(players, colorPage) {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_SIZE
  canvas.height = CANVAS_SIZE
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  for (const player of players) {
    const img = await loadImage(player.canvasSnapshotUrl)
    ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
  }

  if (colorPage) {
    await new Promise(resolve => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      const onDraw = () => {
        ctx.save()
        ctx.globalCompositeOperation = 'multiply'
        ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
        ctx.restore()
        resolve()
      }
      img.onload = onDraw
      img.onerror = () => resolve()
      if (colorPage.svgContent) {
        const blob = new Blob([colorPage.svgContent], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(blob)
        img.onload = () => { onDraw(); URL.revokeObjectURL(url) }
        img.src = url
      } else if (colorPage.uploadDataUrl || colorPage.imageUrl) {
        img.src = colorPage.uploadDataUrl || colorPage.imageUrl
      } else {
        resolve()
      }
    })
  }

  return canvas.toDataURL('image/png')
}

export default function RevealScreen() {
  const { code } = useParams()
  const navigate = useNavigate()
  const playerId = getOrCreatePlayerId()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [capturedUrl, setCapturedUrl] = useState(null)
  const [sessionData, setSessionData] = useState(null)
  const [shareMsg, setShareMsg] = useState('')
  const [saveResult, setSaveResult] = useState(null)
  const [wantsAgain, setWantsAgain] = useState(false)
  const [soloStarting, setSoloStarting] = useState(false)
  const [soloStartError, setSoloStartError] = useState('')

  const autosaveRef = useRef(false)
  const buildInitiatedRef = useRef(false)
  const resetInitiatedRef = useRef(false)
  const sessionRef = useRef(null)

  const isSolo = sessionData?.settings?.mode === 'solo'

  const activePlayers = Object.entries(sessionData?.players || {})
    .filter(([, p]) => p.name && !p.left && p.assignedSection)

  const partnersWantingAgain = Object.entries(sessionData?.players || {})
    .filter(([pid, p]) => pid !== playerId && !p.left && p.wantsAgain)
    .map(([, p]) => p.name)

  const colorPage = (() => {
    const pageId = sessionStorage.getItem(`colorsplit_page_${code}`)
    if (pageId) {
      if (pageId === 'upload') {
        const uploadDataUrl = sessionStorage.getItem(`colorsplit_upload_${code}`)
        return uploadDataUrl ? { id: 'upload', name: 'Custom', svgContent: null, uploadDataUrl } : null
      }
      return getPageById(pageId) || null
    }
    const fbPageId = sessionData?.coloringPage?.id
    if (fbPageId && fbPageId !== 'upload') return getPageById(fbPageId) || null
    const saved = loadGallery().find(a => a.code === code && a.pageId && a.pageId !== 'upload')
    return saved?.pageId ? (getPageById(saved.pageId) || null) : null
  })()

  useEffect(() => {
    const unsub = subscribeToSession(code, (data) => {
      if (!data) return
      setSessionData(data)

      if (data.status === 'picking') {
        navigate(`/session/${code}/pick`, { replace: true })
        return
      }

      // Multiplayer wantsAgain coordinator
      const isMultiplayer = data.settings?.mode !== 'solo'
      if (isMultiplayer && !resetInitiatedRef.current) {
        const active = Object.entries(data.players || {}).filter(([, p]) => p.name && !p.left)
        const allWant = active.length > 0 && active.every(([, p]) => p.wantsAgain)
        const hostActive = data.players?.[data.hostId] && !data.players[data.hostId].left
        const coordinatorId = hostActive ? data.hostId : active.map(([pid]) => pid).sort()[0]
        if (allWant && coordinatorId === playerId) {
          resetInitiatedRef.current = true
          const keys = [
            `colorsplit_page_${code}`,
            `colorsplit_canvas_${code}_left`,
            `colorsplit_canvas_${code}_right`,
            `colorsplit_canvas_${code}_latest`,
            `colorsplit_palette_${code}`,
          ]
          keys.forEach(k => sessionStorage.removeItem(k))
          resetRound(code, data.players).catch(() => navigate(`/session/${code}/pick`))
          return
        }
      }

      if (buildInitiatedRef.current) return
      buildInitiatedRef.current = true
      sessionRef.current = data

      const mode = data.settings?.mode || 'solo'

      if (mode === 'solo') {
        const snapshot = sessionStorage.getItem(`colorsplit_canvas_${code}_latest`)
        if (snapshot) {
          setCapturedUrl(snapshot)
          setLoading(false)
        } else {
          setError('Artwork snapshot not found. Go back and finish your coloring session.')
          setLoading(false)
        }
        return
      }

      // Color Together: composite player PNG snapshots
      const players = Object.entries(data.players || {})
        .filter(([, p]) => p.name && !p.left && p.assignedSection)

      if (players.length === 0) {
        setError('No active players found for this session.')
        setLoading(false)
        return
      }

      const missing = players.filter(([, p]) => !p.canvasSnapshotUrl)
      if (missing.length > 0) {
        setError('Reveal image is still preparing. Try again in a moment.')
        setLoading(false)
        buildInitiatedRef.current = false
        return
      }

      const resolvedColorPage = colorPage
        ?? (data?.coloringPage?.id && data.coloringPage.id !== 'upload'
          ? getPageById(data.coloringPage.id)
          : null)

      buildColorTogetherImage(players.map(([, p]) => p), resolvedColorPage)
        .then(url => {
          setCapturedUrl(url)
          setLoading(false)
        })
        .catch(err => {
          setError(`Image loading failed: ${err.message}. Tap Retry.`)
          setLoading(false)
          buildInitiatedRef.current = false
        })
    })
    return unsub
  }, [code])

  // Auto-save once when artwork is ready
  useEffect(() => {
    if (!capturedUrl || !sessionData || autosaveRef.current) return
    autosaveRef.current = true
    doSaveArtwork()
  }, [capturedUrl, sessionData])

  function handleRetry() {
    setError(null)
    setLoading(true)
    buildInitiatedRef.current = false
    // Re-trigger by briefly resetting session ref so the subscription re-runs build
    const data = sessionRef.current
    if (!data) return
    const mode = data.settings?.mode || 'solo'
    if (mode === 'solo') {
      const snapshot = sessionStorage.getItem(`colorsplit_canvas_${code}_latest`)
      if (snapshot) {
        setCapturedUrl(snapshot)
        setLoading(false)
        buildInitiatedRef.current = true
      } else {
        setError('Artwork snapshot not found. Go back and finish your coloring session.')
        setLoading(false)
      }
      return
    }

    const players = Object.entries(data.players || {})
      .filter(([, p]) => p.name && !p.left && p.assignedSection)

    const missing = players.filter(([, p]) => !p.canvasSnapshotUrl)
    if (missing.length > 0) {
      setError('Reveal image is still preparing. Try again in a moment.')
      setLoading(false)
      return
    }

    buildInitiatedRef.current = true
    const resolvedColorPage = colorPage
      ?? (data?.coloringPage?.id && data.coloringPage.id !== 'upload'
        ? getPageById(data.coloringPage.id)
        : null)

    buildColorTogetherImage(players.map(([, p]) => p), resolvedColorPage)
      .then(url => {
        setCapturedUrl(url)
        setLoading(false)
      })
      .catch(err => {
        setError(`Image loading failed: ${err.message}. Tap Retry.`)
        setLoading(false)
        buildInitiatedRef.current = false
      })
  }

  async function doSaveArtwork() {
    if (!capturedUrl || !sessionData) return
    const players = Object.entries(sessionData.players || {})
      .filter(([, p]) => p.name)
      .map(([id, p]) => ({ id, name: p.name, left: !!p.left }))
    const leftPlayerIds = players.filter(p => p.left).map(p => p.id)
    const pageId = sessionStorage.getItem(`colorsplit_page_${code}`)
      || sessionData?.coloringPage?.id
      || loadGallery().find(a => a.code === code)?.pageId
      || ''
    const completedAt = Date.now()
    const { ok, entry } = saveArtwork({
      id: `${code}_${completedAt}`,
      code,
      name: colorPage?.name ? `My ${colorPage.name}` : 'My Artwork',
      completedAt,
      pageId,
      mode: sessionData.settings?.mode || 'solo',
      players,
      savedByPlayerId: playerId,
      status: leftPlayerIds.length > 0 ? 'completed_after_leave' : 'completed',
      leftPlayerIds,
      finalImageUrl: await compressImageDataUrl(capturedUrl),
      strokes: [],
      allStrokes: null,
      tearLine: null,
      localOwnerType: user ? 'user' : 'guest',
      localOwnerId: user ? user.uid : playerId,
    })
    if (user && entry) {
      saveArtworkToCloud(user.uid, entry)
        .then(() => markArtworkMigrated(entry.id, user.uid, entry.id))
        .catch(e => console.warn('Cloud gallery save failed:', e?.message))
    }
    setSaveResult(ok ? 'saved' : 'failed')
    setTimeout(() => setSaveResult(null), 3200)
  }

  function handleDownload() {
    if (!capturedUrl) return
    const link = document.createElement('a')
    link.download = `colorsplit-artwork-${code}.png`
    link.href = capturedUrl
    link.click()
  }

  async function handleShare() {
    const url = window.location.origin
    const canShareFiles = capturedUrl && navigator.canShare?.({
      files: [new File([], 'test.png', { type: 'image/png' })],
    })
    if (canShareFiles) {
      try {
        const res = await fetch(capturedUrl)
        const blob = await res.blob()
        const file = new File([blob], `colorsplit-${code}.png`, { type: 'image/png' })
        await navigator.share({ title: 'My ColorSplit artwork!', files: [file] })
        setShareMsg('Shared!')
        setTimeout(() => setShareMsg(''), 2500)
        return
      } catch (e) {
        if (e?.name === 'AbortError') return
      }
    }
    if (!canShareFiles && navigator.share) {
      try {
        await navigator.share({ title: 'ColorSplit', text: 'Check out my ColorSplit artwork!', url })
        setShareMsg('Shared!')
        setTimeout(() => setShareMsg(''), 2500)
        return
      } catch (e) {
        if (e?.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setShareMsg('Link copied!')
    } catch {
      setShareMsg('Copy failed')
    }
    setTimeout(() => setShareMsg(''), 2500)
  }

  async function handleAgain() {
    if (isSolo) {
      const keys = [
        `colorsplit_page_${code}`,
        `colorsplit_canvas_${code}_left`,
        `colorsplit_canvas_${code}_right`,
        `colorsplit_canvas_${code}_latest`,
        `colorsplit_palette_${code}`,
      ]
      keys.forEach(k => sessionStorage.removeItem(k))
      try {
        await resetRound(code, sessionData?.players || {})
      } catch {
        navigate(`/session/${code}/pick`)
      }
    } else {
      setWantsAgain(true)
      try {
        await setPlayerWantsAgain(code, playerId, true)
      } catch {
        setWantsAgain(false)
      }
    }
  }

  async function handleCancelAgain() {
    setWantsAgain(false)
    try {
      await setPlayerWantsAgain(code, playerId, false)
    } catch {}
  }

  async function handleLeaveRoom() {
    try { await leaveRoom(code, playerId) } catch {}
    navigate('/', { replace: true })
  }

  async function handleStartSolo() {
    if (soloStarting) return
    setSoloStarting(true)
    setSoloStartError('')
    if (!navigator.onLine) {
      setSoloStartError("You're offline — check your connection and try again.")
      setSoloStarting(false)
      return
    }
    try { await leaveRoom(code, playerId) } catch {}
    try {
      const playerName = getOrCreatePlayerName()
      const p = getProfile()
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Taking too long — check your connection and try again.')), 9000)
      )
      const newCode = await Promise.race([
        createSession(playerId, playerName, true, p?.avatarId ?? null, p?.colorId ?? null, user?.uid ?? null),
        timeout,
      ])
      navigate(`/session/${newCode}/pick`, { replace: true })
    } catch (e) {
      setSoloStartError(e.message || 'Could not start solo session — try again.')
      setSoloStarting(false)
    }
  }

  const everyoneElseLeft = !isSolo && Object.entries(sessionData?.players || {})
    .filter(([pid, p]) => pid !== playerId && p.name && !p.left).length === 0

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bg-[#1a1a1a] min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-4xl animate-spin" style={{ animationDuration: '1.2s' }}>⏳</div>
        <p className="text-white/40 font-body text-sm">Building your artwork…</p>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="bg-[#1a1a1a] min-h-screen flex flex-col items-center justify-center gap-5 px-6">
        <div className="text-4xl">😕</div>
        <p className="text-white/70 font-body text-sm text-center max-w-xs">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={handleRetry}
            className="bg-violet-600 text-white font-semibold py-3 px-6 rounded-2xl font-body text-sm active:scale-95 transition-transform"
          >
            Retry
          </button>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="bg-white/10 text-white/70 font-semibold py-3 px-6 rounded-2xl font-body text-sm active:scale-95 transition-transform"
          >
            Home
          </button>
        </div>
      </div>
    )
  }

  // ── Reveal ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="bg-gradient-to-b from-[#FFFDF8] via-[#FDF8F2] to-[#EDE8FF] flex flex-col items-center h-screen overflow-y-auto justify-start"
    >
      <div
        className="flex flex-col items-center w-full px-5 max-w-lg gap-3"
        style={{
          paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
          paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
        }}
      >
        {/* Header */}
        <div className="text-center">
          <div className="text-4xl mb-2">🎉</div>
          <h1
            className="font-display text-3xl text-gray-900 leading-tight"
            style={{ fontFamily: "'Fredoka One', cursive" }}
          >
            Masterpiece!
          </h1>
          <p className="text-gray-500 font-body text-sm mt-1">
            {isSolo ? 'Saved to your gallery.' : 'Made together. Saved to your gallery.'}
          </p>
        </div>

        {/* Save feedback toast */}
        {saveResult && (
          <div className={`w-full text-center px-4 py-2 rounded-2xl font-body text-sm font-semibold ${
            saveResult === 'saved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {saveResult === 'saved'
              ? (user ? '✓ Saved to your account gallery' : '✓ Saved to your gallery')
              : "⚠️ Couldn't save — device storage may be full"}
          </div>
        )}

        {/* Artwork */}
        <div
          className="w-full max-w-[340px] rounded-3xl overflow-hidden bg-white"
          style={{ aspectRatio: '1', boxShadow: '0 0 32px rgba(124,92,255,0.18), 0 8px 20px rgba(0,0,0,0.07)' }}
        >
          {capturedUrl ? (
            <img src={capturedUrl} alt="Masterpiece" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-50 text-5xl">🎨</div>
          )}
        </div>

        {/* Utility row */}
        <div className="w-full grid grid-cols-3 gap-2.5">
          <button
            onClick={handleDownload}
            disabled={!capturedUrl}
            className="flex flex-col items-center gap-1.5 bg-white border border-gray-100 rounded-2xl py-2.5 px-2 active:scale-95 transition-transform shadow-sm disabled:opacity-40"
          >
            <span className="text-xl">⬇️</span>
            <span className="text-gray-800 font-body text-xs font-semibold">Download</span>
          </button>

          <button
            onClick={handleShare}
            className="flex flex-col items-center gap-1.5 bg-white border border-gray-100 rounded-2xl py-2.5 px-2 active:scale-95 transition-transform shadow-sm"
          >
            <span className="text-xl">{shareMsg ? '✓' : '🔗'}</span>
            <span className="text-gray-800 font-body text-xs font-semibold">{shareMsg || 'Share'}</span>
          </button>

          <button
            onClick={() => navigate('/gallery')}
            className="flex flex-col items-center gap-1.5 bg-white border border-gray-100 rounded-2xl py-2.5 px-2 active:scale-95 transition-transform shadow-sm"
          >
            <span className="text-xl">🖼️</span>
            <span className="text-gray-800 font-body text-xs font-semibold">Gallery</span>
          </button>
        </div>

        {/* Navigation */}
        <div className="w-full">
          {/* Partner wants-again nudge */}
          {!isSolo && !wantsAgain && partnersWantingAgain.length > 0 && (
            <div className="w-full bg-violet-50 border border-violet-200 rounded-2xl px-4 py-2.5 text-center mb-3">
              <p className="text-violet-600 font-body text-xs">
                🎮 {partnersWantingAgain.join(' & ')} wants to play again
              </p>
            </div>
          )}

          {wantsAgain ? (
            <div className="w-full bg-white border border-gray-100 rounded-3xl px-5 py-5 flex flex-col gap-4 shadow-sm">
              <div className="text-center">
                <div className="text-2xl mb-1.5">⏳</div>
                <p className="text-gray-700 font-body text-sm font-semibold">
                  Waiting for your coloring buddy…
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-2.5">
                  <span className="text-gray-500 font-body text-sm">You</span>
                  <span className="text-green-600 font-body text-sm font-semibold">Ready ✓</span>
                </div>
                {Object.entries(sessionData?.players || {})
                  .filter(([pid, p]) => pid !== playerId && !p.left)
                  .map(([pid, p]) => (
                    <div key={pid} className="flex items-center justify-between bg-gray-50 rounded-2xl px-4 py-2.5">
                      <span className="text-gray-500 font-body text-sm">{p.name}</span>
                      {p.wantsAgain
                        ? <span className="text-green-600 font-body text-sm font-semibold">Ready ✓</span>
                        : <span className="text-gray-400 font-body text-sm">Waiting…</span>
                      }
                    </div>
                  ))
                }
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCancelAgain}
                  className="flex-1 bg-gray-100 text-gray-600 font-semibold py-3 rounded-2xl font-body text-sm active:scale-95 transition-transform border border-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLeaveRoom}
                  className="flex-1 bg-transparent text-red-400 font-semibold py-3 rounded-2xl font-body text-sm active:scale-95 transition-transform border border-red-200"
                >
                  Leave Room
                </button>
              </div>
            </div>

          ) : everyoneElseLeft ? (
            <div className="flex flex-col gap-3">
              <button
                onClick={handleStartSolo}
                disabled={soloStarting}
                className="w-full text-white font-bold py-4 rounded-2xl shadow-lifted active:scale-95 transition-transform font-body disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #8B6EF8 0%, #7C5CFF 100%)' }}
              >
                {soloStarting ? '…Starting solo…' : '🎨 Start Solo Coloring'}
              </button>
              {soloStartError && (
                <p className="text-red-500 font-body text-xs text-center -mt-1">{soloStartError}</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handleLeaveRoom}
                  className="flex-1 bg-white text-gray-600 font-semibold py-3.5 rounded-2xl font-body text-sm active:scale-95 transition-transform border border-gray-200 shadow-sm"
                >
                  🏠 Back Home
                </button>
                <button
                  onClick={() => navigate('/gallery')}
                  className="flex-1 bg-white text-gray-800 font-semibold py-3.5 rounded-2xl font-body text-sm active:scale-95 transition-transform border border-gray-200 shadow-sm"
                >
                  🖼️ View Gallery
                </button>
              </div>
            </div>

          ) : (
            <div className="flex gap-3">
              <button
                onClick={isSolo ? () => navigate('/', { replace: true }) : handleLeaveRoom}
                className={`flex-1 bg-white font-semibold py-3.5 rounded-2xl font-body text-sm active:scale-95 transition-transform border shadow-sm ${
                  isSolo ? 'text-gray-600 border-gray-200' : 'text-red-400 border-red-200'
                }`}
              >
                {isSolo ? '🏠 Home' : '🚪 Leave Room'}
              </button>
              <button
                onClick={() => navigate('/gallery')}
                className="flex-1 bg-white text-gray-800 font-semibold py-3.5 rounded-2xl font-body text-sm active:scale-95 transition-transform border border-gray-200 shadow-sm"
              >
                🖼️ View Gallery
              </button>
            </div>
          )}
        </div>

        {/* Play Again */}
        {!wantsAgain && !everyoneElseLeft && (
          <button
            onClick={handleAgain}
            className="w-full text-white font-bold py-4 rounded-2xl shadow-lifted active:scale-95 transition-transform font-body"
            style={{ background: 'linear-gradient(135deg, #8B6EF8 0%, #7C5CFF 100%)' }}
          >
            🔄 Play Again
          </button>
        )}
      </div>
    </div>
  )
}
