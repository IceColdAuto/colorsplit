import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AVATAR_COLORS, saveProfile } from '../lib/profile'
import { updateCloudProfile, getUserProfile } from '../lib/auth'
import useAuth from '../hooks/useAuth'
import AccountSection from './AccountSection'

function PencilTip({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden="true">
      {/* Eraser cap */}
      <rect x="13" y="3" width="18" height="9" rx="4.5" fill="rgba(255,255,255,0.62)" />
      {/* Ferrule band */}
      <rect x="13" y="11" width="18" height="3.5" fill="rgba(0,0,0,0.11)" />
      {/* Shine on body */}
      <rect x="16" y="16" width="6" height="12" rx="3" fill="rgba(255,255,255,0.28)" />
      {/* Wood reveal */}
      <polygon points="13,30 22,42 31,30" fill="#EFC88A" />
      {/* Graphite tip */}
      <polygon points="17,35 22,42 27,35" fill="#8C7B75" />
    </svg>
  )
}

export default function ProfileButton({ profile, onProfileChange }) {
  const { user, profile: authProfile } = useAuth()
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState(profile?.username || '')
  const [avatarId, setAvatarId] = useState(profile?.avatarId || 'cat')
  const [colorId, setColorId] = useState(profile?.colorId || 'peach')
  const [saved, setSaved] = useState(false)

  const color = AVATAR_COLORS.find(c => c.id === colorId) || AVATAR_COLORS[0]
  const displayColor = AVATAR_COLORS.find(c => c.id === profile?.colorId) || AVATAR_COLORS[0]

  async function openSheet() {
    // Init immediately from best local data so the sheet opens without waiting
    setUsername(profile?.username || authProfile?.displayName || '')
    setAvatarId(profile?.avatarId || authProfile?.avatarId || 'cat')
    setColorId(profile?.colorId || authProfile?.colorId || 'peach')
    setSaved(false)
    setOpen(true)
    // Overwrite with fresh cloud data (source of truth for signed-in users)
    if (user?.uid) {
      try {
        const fresh = await getUserProfile(user.uid)
        if (fresh) {
          setUsername(fresh.displayName || '')
          setAvatarId(fresh.avatarId || 'cat')
          setColorId(fresh.colorId || 'peach')
        }
      } catch {}
    }
  }

  function handleSave() {
    const name = username.trim() || authProfile?.displayName || profile?.username || 'Player'
    const updated = { username: name, avatarId, colorId }
    saveProfile(updated)
    onProfileChange(updated)
    if (user?.uid) updateCloudProfile(user.uid, { displayName: name, avatarId, colorId }).catch(() => {})
    setSaved(true)
    setTimeout(() => { setSaved(false); setOpen(false) }, 900)
  }

  return (
    <>
      {/* Pencil-tip avatar button */}
      <button
        onClick={openSheet}
        className="w-11 h-11 rounded-[14px] flex items-center justify-center active:scale-90 transition-transform shadow-paper border border-white/40 flex-shrink-0 overflow-hidden"
        style={{ background: displayColor.hex }}
        title={profile?.username || 'Profile'}
      >
        <PencilTip size={30} />
      </button>

      {/* Edit sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-ink/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-lg bg-cream rounded-t-[32px] px-6 pt-5 pb-10 max-h-[85vh] overflow-y-auto"
            >
              <div className="w-10 h-1 bg-ink/15 rounded-full mx-auto mb-5" />

              {/* Live preview */}
              <div className="flex items-center gap-4 mb-6">
                <div
                  className="w-16 h-16 rounded-[18px] flex items-center justify-center shadow-lifted flex-shrink-0 overflow-hidden"
                  style={{ background: color.hex }}
                >
                  <PencilTip size={44} />
                </div>
                <div>
                  <div className="font-display text-xl text-ink" style={{ fontFamily: "'Fredoka One', cursive" }}>
                    {username || profile?.username}
                  </div>
                  <div className="text-ink/40 text-xs font-body">{color.label} pencil</div>
                </div>
              </div>

              {/* Name input */}
              <p className="text-ink/40 text-xs font-bold uppercase tracking-wider font-body mb-2">Name</p>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                maxLength={20}
                className="w-full text-lg font-body bg-white rounded-2xl px-4 py-3 border-2 border-ink/10 focus:border-blue-400 outline-none transition-colors text-ink mb-4"
              />

              {/* Pencil color */}
              <p className="text-ink/40 text-xs font-bold uppercase tracking-wider font-body mb-2">Pencil color</p>
              <div className="flex gap-2 mb-5">
                {AVATAR_COLORS.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setColorId(c.id)}
                    className={`flex-1 h-10 rounded-xl transition-all active:scale-95 border-2 ${colorId === c.id ? 'border-blue-500 scale-110' : 'border-transparent'}`}
                    style={{ background: c.hex }}
                    title={c.label}
                  />
                ))}
              </div>

              {/* Account / friends */}
              <AccountSection />

              <button
                onClick={handleSave}
                className={`w-full font-bold py-4 rounded-2xl font-body text-lg active:scale-95 transition-all ${
                  saved ? 'bg-green-500 text-white' : 'bg-blue-500 text-white shadow-lifted'
                }`}
              >
                {saved ? '✓ Saved!' : 'Save Profile'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
