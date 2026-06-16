import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { COLORING_PAGES, CATEGORIES, DURATIONS } from '../lib/coloringPages'
import { updateColoringPage, updateSessionStatus, updateSessionSettings, updateRoundController, subscribeToSession, getOrCreatePlayerId, leaveRoom, clearActiveRoom } from '../lib/session'

import RoomStatusBar from '../components/RoomStatusBar'
import LeaveRoomModal from '../components/LeaveRoomModal'

const DIFFICULTY_TABS = ['medium', 'hard']

const PRIMARY_GRADIENT = 'linear-gradient(135deg, #8B6EF8 0%, #7C5CFF 100%)'

export default function ColoringPagePicker() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('medium')
  const [selected, setSelected] = useState(null)
  const [session, setSession] = useState(null)

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
      sessionStorage.removeItem(`colorsplit_palette_${code}`)
      try { await updateSessionStatus(code, 'coloring') } catch {}
      navigate(`/session/${code}/color`)
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


  return (
    <motion.div
      className="min-h-screen relative"
      style={{ background: '#FDF8F2' }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
    >
      {/* Decorative background blobs — mirrors home screen palette at lower opacity */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,155,46,0.13) 0%, transparent 70%)' }} />
        <div className="absolute top-1/3 -left-20 w-60 h-60 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(162,110,255,0.11) 0%, transparent 70%)' }} />
        <div className="absolute bottom-40 -right-10 w-52 h-52 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(236,110,170,0.09) 0%, transparent 70%)' }} />
      </div>

      {/* Centered content column — constrains layout on desktop */}
      <div className="relative max-w-lg mx-auto flex flex-col min-h-screen">

        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-10 pb-4">
          <button
            onClick={() => {
              // Explicit navigation: after "Play Again" the history entry behind
              // this screen is /color, whose status subscription bounces straight
              // back here — navigate(-1) traps the user on this screen forever.
              if (isSolo) { clearActiveRoom(); navigate('/'); return }
              setShowLeaveModal(true)
            }}
            className="text-ink/50 font-body active:scale-95 transition-transform text-lg mt-1"
          >←</button>
          <div>
            <h1 className="font-display text-2xl leading-tight" style={{ fontFamily: "'Fredoka One', cursive", color: '#4A326F' }}>
              Pick your page <span style={{ color: '#EC6EAA' }}>✦</span>
            </h1>
            <p className="font-body text-sm mt-1" style={{ color: '#8A7C91' }}>Find your next coloring adventure.</p>
          </div>
        </div>

        {!isSolo && (
          <div className="flex justify-center px-6 pb-2">
            <div className="rounded-2xl overflow-hidden w-full max-w-xs shadow-sm">
              <RoomStatusBar session={session} code={code} />
            </div>
          </div>
        )}

        {/* Category tabs — pill style, centered, not stretched */}
        <div className="flex justify-center gap-2 px-6 mt-2 mb-4">
          {DIFFICULTY_TABS.map(d => (
            <button
              key={d}
              onClick={() => setActiveTab(d)}
              className={`py-1.5 px-4 rounded-2xl font-semibold font-body text-sm transition-all duration-150 active:scale-95 whitespace-nowrap ${
                activeTab === d ? 'shadow-sm' : 'bg-white/80 text-ink/55 border border-ink/10'
              }`}
              style={activeTab === d ? { background: '#EDE0FF', color: '#7C6EFA' } : {}}
            >
              {DURATIONS[d].label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-40 no-scrollbar">
          <div className="grid grid-cols-2 gap-5">
            <AnimatePresence initial={false}>
              {filtered.map(page => (
                <motion.button
                  key={page.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => setSelected(page)}
                  className={`relative rounded-3xl shadow-paper overflow-hidden border-2 transition-all active:scale-95 ${
                    selected?.id === page.id ? 'shadow-lifted' : 'border-transparent'
                  }`}
                  style={{
                    background: '#FEFCF8',
                    borderColor: selected?.id === page.id ? 'rgba(124,92,255,0.35)' : 'transparent',
                  }}
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
                      className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ background: '#7C5CFF' }}
                    >
                      ✓
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </AnimatePresence>

          </div>
        </div>

      </div>{/* end centered column */}

      {/* Bottom bar — full width bg, content constrained to match column */}
      <div className="fixed bottom-0 left-0 right-0 backdrop-blur-sm border-t border-ink/5" style={{ background: 'rgba(253,248,242,0.96)' }}>
        <div className="max-w-lg mx-auto px-6 pb-8 pt-4">
          <button
            onClick={handleConfirm}
            disabled={!selected}
            className="w-full font-bold py-4 rounded-2xl active:scale-95 transition-all font-body text-base"
            style={selected
              ? { background: PRIMARY_GRADIENT, color: 'white', boxShadow: '0 4px 14px rgba(124,92,255,0.28)' }
              : { background: '#EDE0FF', color: '#9B8ED6', cursor: 'default' }
            }
          >
            {selected ? `Use "${selected.name}" →` : 'Select a coloring page'}
          </button>
        </div>
      </div>

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
