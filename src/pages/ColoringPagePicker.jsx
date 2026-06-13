import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { COLORING_PAGES, CATEGORIES, DURATIONS } from '../lib/coloringPages'
import { updateColoringPage, updateSessionStatus, updateSessionSettings, updateRoundController, subscribeToSession, getOrCreatePlayerId, leaveRoom, clearActiveRoom } from '../lib/session'
import { generatePalette } from '../lib/gallery'
import RoomStatusBar from '../components/RoomStatusBar'
import LeaveRoomModal from '../components/LeaveRoomModal'

const DIFFICULTY_TABS = ['easy', 'medium', 'hard']

export default function ColoringPagePicker() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('easy')
  const [selected, setSelected] = useState(null)
  const [session, setSession] = useState(null)
  const [paletteEnabled, setPaletteEnabled] = useState(false)
  const [showPaletteChallenge, setShowPaletteChallenge] = useState(false)
  const [soloPalette, setSoloPalette] = useState([])

  const playerId = getOrCreatePlayerId()
  const filtered = useMemo(() => COLORING_PAGES.filter(p => p.duration === activeTab), [activeTab])
  const isSolo = session?.settings?.mode === 'solo'
  const isHost = session?.hostId === playerId
  const isLeavingRef = useRef(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [abandonedByName, setAbandonedByName] = useState(null)

  useEffect(() => {
    const unsub = subscribeToSession(code, (data) => {
      if (isLeavingRef.current) return
      if (!data) return
      // Block only when NO other active player remains — in a 3-4 player room
      // one person leaving must not end the round for everyone else.
      const isMultiplayer = data.settings?.mode !== 'solo'
      if (isMultiplayer) {
        const others = Object.entries(data.players || {}).filter(([pid]) => pid !== playerId)
        const othersActive = others.filter(([, p]) => p.name && !p.left)
        const othersLeft = others.filter(([, p]) => p.left)
        if (othersLeft.length > 0 && othersActive.length === 0) {
          setAbandonedByName(othersLeft[0][1].name || 'The other player'); return
        }
      }
      setSession(data)
      // 'picking' = host is on this screen, no redirect needed
      if (data.status === 'settings') navigate(`/session/${code}/settings`)
      if (data.status === 'tearing') navigate(`/session/${code}/tear`)
      if (data.status === 'ready_check') navigate(`/session/${code}/ready`)
      if (data.status === 'coloring') navigate(`/session/${code}/color`)
      if (data.status === 'waiting' && data.settings?.mode !== 'solo') navigate(`/session/${code}/lobby`)
    })
    return unsub
  }, [code])

  async function handleConfirm() {
    if (!selected) return
    // Persist uploaded image as dataURL before navigating away
    if (selected.id === 'upload' && selected.uploadDataUrl) {
      sessionStorage.setItem(`colorsplit_upload_${code}`, selected.uploadDataUrl)
    } else {
      sessionStorage.removeItem(`colorsplit_upload_${code}`)
    }
    try { await updateColoringPage(code, { type: 'builtin', id: selected.id }) } catch {}
    sessionStorage.setItem(`colorsplit_page_${code}`, selected.id)

    if (isSolo) {
      if (paletteEnabled) {
        const palette = generatePalette(5)
        sessionStorage.setItem(`colorsplit_palette_${code}`, JSON.stringify(palette))
        setSoloPalette(palette)
        setShowPaletteChallenge(true)
      } else {
        // Free color — clear any previous palette
        sessionStorage.removeItem(`colorsplit_palette_${code}`)
        try { await updateSessionStatus(code, 'coloring') } catch {}
        navigate(`/session/${code}/color`)
      }
    } else {
      // Multiplayer: hardcoded to Tear Mode + Reveal at End, skip settings screen.
      try {
        await updateRoundController(code, playerId)
        await updateSessionSettings(code, { mode: 'tear', visibility: 'reveal', lineHelper: 'correction' })
        await updateSessionStatus(code, 'tearing')
      } catch {}
      navigate(`/session/${code}/tear`)
    }
  }

  async function handleLeaveConfirm() {
    isLeavingRef.current = true
    setShowLeaveModal(false)
    try { await leaveRoom(code, playerId) } catch {}
    navigate('/', { replace: true })
  }

  async function handleStartFromPalette() {
    try { await updateSessionStatus(code, 'coloring') } catch {}
    navigate(`/session/${code}/color`)
  }

  function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    // FileReader gives us a persistent dataURL that survives navigation
    const reader = new FileReader()
    reader.onload = (evt) => {
      setSelected({
        id: 'upload',
        name: file.name,
        svgContent: null,
        imageUrl: objectUrl,
        uploadDataUrl: evt.target.result,
        duration: activeTab,
        category: 'upload',
      })
    }
    reader.readAsDataURL(file)
  }

  return (
    <motion.div
      className="min-h-screen bg-cream flex flex-col"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      {/* Header */}
      <div className="flex items-center gap-4 px-6 pt-8 pb-4">
        <button
          onClick={() => {
            // Explicit navigation: after "Play Again" the history entry behind
            // this screen is /color, whose status subscription bounces straight
            // back here — navigate(-1) traps the user on this screen forever.
            if (isSolo) { clearActiveRoom(); navigate('/'); return }
            setShowLeaveModal(true)
          }}
          className="text-ink/50 font-body active:scale-95 transition-transform text-lg"
        >←</button>
        <h1 className="font-display text-2xl text-ink" style={{ fontFamily: "'Fredoka One', cursive" }}>
          Choose a Coloring Page
        </h1>
      </div>

      {!isSolo && <RoomStatusBar session={session} code={code} />}

      {/* Level tabs */}
      <div className="flex gap-2 px-6 mb-4">
        {DIFFICULTY_TABS.map(d => (
          <button
            key={d}
            onClick={() => setActiveTab(d)}
            className={`flex-1 py-2.5 px-3 rounded-2xl font-semibold font-body text-sm transition-colors duration-150 active:scale-95 ${
              activeTab === d
                ? 'bg-blue-500 text-white'
                : 'bg-white/80 text-ink/55 border border-ink/10'
            }`}
          >
            <div>{DURATIONS[d].label}</div>
            <div className={`text-xs font-normal ${activeTab === d ? 'text-white/75' : 'text-ink/35'}`}>{DURATIONS[d].desc}</div>
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-44 no-scrollbar">
        <div className="grid grid-cols-2 gap-4">
          <AnimatePresence initial={false}>
            {filtered.map(page => (
              <motion.button
                key={page.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={() => setSelected(page)}
                className={`relative bg-white rounded-3xl shadow-paper overflow-hidden border-2 transition-all active:scale-95 ${
                  selected?.id === page.id ? 'border-blue-500 shadow-lifted' : 'border-transparent'
                }`}
              >
                <div className="aspect-square p-2 flex items-center justify-center overflow-hidden">
                  {page.svgContent ? (
                    <div
                      className="w-full h-full"
                      style={{ lineHeight: 0 }}
                      dangerouslySetInnerHTML={{
                        __html: page.svgContent.replace(
                          /width="400" height="400"/,
                          'width="100%" height="100%" style="display:block"'
                        )
                      }}
                    />
                  ) : (
                    <img
                      src={page.thumbnailUrl || page.imageUrl}
                      alt={page.name}
                      className="w-full h-full object-contain"
                      style={{ display: 'block' }}
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="px-3 pb-3 text-left">
                  <div className="font-semibold font-body text-ink text-sm">{page.name}</div>
                  <div className="text-ink/40 text-xs font-body">{CATEGORIES[page.category] || page.category}</div>
                </div>
                {selected?.id === page.id && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2 w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold"
                  >
                    ✓
                  </motion.div>
                )}
              </motion.button>
            ))}
          </AnimatePresence>

          {/* Upload card — solo only; dataURL is not synced in multiplayer */}
          {isSolo && (
            <label className="bg-white rounded-3xl shadow-paper overflow-hidden border-2 border-dashed border-ink/20 aspect-square flex flex-col items-center justify-center gap-2 cursor-pointer active:scale-95 transition-transform hover:border-blue-400">
              <span className="text-3xl">📁</span>
              <span className="font-semibold font-body text-ink/60 text-sm text-center px-3">Upload your own</span>
              <span className="text-ink/30 text-xs font-body">PNG or JPG</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </label>
          )}
        </div>

        {selected?.id === 'upload' && selected?.imageUrl && (
          <div className="mt-4 bg-white rounded-3xl shadow-paper p-4 border-2 border-blue-500">
            <p className="font-semibold font-body text-ink mb-2 text-sm">Upload: {selected.name}</p>
            <img src={selected.imageUrl} alt="upload preview" className="w-full rounded-xl object-contain max-h-40" />
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-cream/95 backdrop-blur-sm px-6 pb-8 pt-4 border-t border-ink/5 space-y-3">
        {/* Palette Challenge toggle (solo only) */}
        {isSolo && (
          <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 border border-ink/8">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#FFF3E0,#FFD4A3)' }}>
                <span className="text-lg">🎨</span>
              </div>
              <div>
                <div className="font-semibold font-body text-ink text-sm">Palette Challenge</div>
                <div className="text-ink/40 text-xs font-body">5 random colors, locked</div>
              </div>
            </div>
            {/* Toggle switch */}
            <button
              onClick={() => setPaletteEnabled(v => !v)}
              className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${paletteEnabled ? 'bg-blue-500' : 'bg-ink/15'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${paletteEnabled ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={!selected}
          className="w-full bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lifted active:scale-95 transition-all font-body text-lg disabled:opacity-40"
        >
          {selected ? `Use "${selected.name}" →` : 'Select a coloring page'}
        </button>
      </div>

      {/* Palette challenge reveal overlay */}
      <AnimatePresence>
        {showPaletteChallenge && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/70 backdrop-blur-sm flex items-end justify-center z-50"
          >
            <motion.div
              initial={{ y: 120 }}
              animate={{ y: 0 }}
              exit={{ y: 120 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="bg-cream w-full max-w-lg rounded-t-3xl p-6 pb-10"
            >
              <div className="text-center mb-5">
                <div className="text-4xl mb-2">🎨</div>
                <h2 className="font-display text-2xl text-ink mb-1" style={{ fontFamily: "'Fredoka One', cursive" }}>
                  Your Color Challenge!
                </h2>
                <p className="text-ink/50 font-body text-sm leading-relaxed">
                  These 5 colors are locked in for this session.<br />You can only use these — make them count!
                </p>
              </div>
              <div className="flex justify-center gap-4 mb-6">
                {soloPalette.map((c, i) => (
                  <motion.div
                    key={c}
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: i * 0.08, type: 'spring', stiffness: 400, damping: 20 }}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <div className="rounded-2xl shadow-lifted" style={{ width: 48, height: 48, background: c }} />
                    <span className="text-ink/35 text-xs font-body font-mono">{c}</span>
                  </motion.div>
                ))}
              </div>
              <button
                onClick={handleStartFromPalette}
                className="w-full bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lifted active:scale-95 transition-all font-body text-lg"
              >
                Start Coloring! 🖌️
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isSolo && (
        <LeaveRoomModal
          showConfirm={showLeaveModal}
          onCancel={() => setShowLeaveModal(false)}
          onConfirm={handleLeaveConfirm}
          abandonedByName={abandonedByName}
          onGoHome={() => { isLeavingRef.current = true; navigate('/', { replace: true }) }}
        />
      )}
    </motion.div>
  )
}
