import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { logBetaEvent } from '../lib/analytics'
import { motion, AnimatePresence } from 'framer-motion'
import {
  createSession, joinSession, getOrCreatePlayerId, getOrCreatePlayerName,
  getActiveRoom, clearActiveRoom, getSession,
} from '../lib/session'
import { DEMO_MODE } from '../lib/firebase'
import { getProfile, isProfileComplete, getCachedAccountProfile, saveCachedAccountProfile } from '../lib/profile'
import { getUserProfile } from '../lib/auth'
import ProfileSetup from '../components/ProfileSetup'
import ProfileButton from '../components/ProfileButton'
import AuthModal from '../components/AuthModal'
import useAuth from '../hooks/useAuth'
import { subscribeToIncomingInvites, respondToInvite } from '../lib/invites'

// ─── Stagger helpers ──────────────────────────────────────────────────────────
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring', stiffness: 300, damping: 26 },
})

export default function HomeScreen() {
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joining, setJoining] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [soloCreating, setSoloCreating] = useState(false)
  const [soloError, setSoloError] = useState('')
  const [profile, setProfile] = useState({ avatarId: 'cat', colorId: 'peach', username: '' })
  const [showProfileSetup, setShowProfileSetup] = useState(false)
  const [resumeRoom, setResumeRoom] = useState(null)
  const { user, profile: cloudProfile, authAvailable, loading: authLoading, profileLoading } = useAuth()
  const hadUser = useRef(false)
  const appOpenFired = useRef(false)
  const [showAuth, setShowAuth] = useState(false)
  const [invites, setInvites] = useState([])
  const [inviteBusy, setInviteBusy] = useState(null) // invite id being joined
  const [inviteError, setInviteError] = useState('')

  useEffect(() => {
    if (appOpenFired.current) return
    appOpenFired.current = true
    logBetaEvent('app_open')
  }, [])

  // Incoming friend invites — signed-in users only, live-updated.
  useEffect(() => {
    if (!user) { setInvites([]); return }
    return subscribeToIncomingInvites(user.uid, setInvites)
  }, [user])

  async function handleJoinInvite(inv) {
    if (inviteBusy) return
    setInviteBusy(inv.id)
    setInviteError('')
    try {
      const playerId = getOrCreatePlayerId()
      const { name: playerName, avatarId, colorId } = await resolveMultiplayerIdentity()
      await joinSession(inv.sessionCode, playerId, playerName, avatarId, colorId, user?.uid ?? null)
      respondToInvite(user.uid, inv.id, 'accepted').catch(() => {})
      navigate(`/session/${inv.sessionCode}/lobby`)
    } catch (e) {
      // Room gone, full, or already started — retire the invite so it
      // doesn't keep failing on the home screen.
      setInviteError(e.message || 'Could not join that room')
      setTimeout(() => setInviteError(''), 4000)
      respondToInvite(user.uid, inv.id, 'expired').catch(() => {})
      setInviteBusy(null)
    }
  }

  function handleDeclineInvite(inv) {
    respondToInvite(user.uid, inv.id, 'declined').catch(() => {})
  }

  // Resumable session detection: a room we were in that is still running.
  useEffect(() => {
    const active = getActiveRoom()
    if (!active) return
    let cancelled = false
    const playerId = getOrCreatePlayerId()
    getSession(active.code).then(session => {
      if (cancelled) return
      const me = session?.players?.[playerId]
      // Resumable as long as *I* didn't leave and the round isn't finished.
      // Another player leaving (session.abandoned) must never erase MY resume —
      // I can keep coloring and finish without them.
      const stillRunning = session && session.status !== 'done' && me && !me.left
      if (stillRunning) {
        const others = Object.entries(session.players || {}).filter(([pid]) => pid !== playerId)
        const someoneLeft = others.some(([, p]) => p.left)
        setResumeRoom({
          code: active.code,
          status: session.status,
          solo: session.settings?.mode === 'solo',
          someoneLeft,
        })
      } else {
        clearActiveRoom()
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  function handleResume() {
    if (!resumeRoom) return
    const routeByStatus = {
      waiting: 'lobby', picking: 'pick', settings: 'settings',
      tearing: 'tear', ready_check: 'ready', coloring: 'color',
    }
    navigate(`/session/${resumeRoom.code}/${routeByStatus[resumeRoom.status] || 'lobby'}`)
  }

  // Guest: load from guest localStorage. Logged-in: use uid-specific cache while cloud loads.
  useEffect(() => {
    if (authLoading) return
    if (user) {
      const cached = getCachedAccountProfile(user.uid)
      setProfile(cached || { avatarId: 'cat', colorId: 'peach', username: '' })
    } else {
      const p = getProfile()
      setProfile(p || { avatarId: 'cat', colorId: 'peach', username: '' })
    }
  }, [user, authLoading])

  // Auth-aware ProfileSetup trigger — waits for Firebase before deciding.
  useEffect(() => {
    if (authLoading) return
    if (user) {
      hadUser.current = true
      // Google/Apple populate user.displayName immediately; cloud profile may
      // arrive slightly later via ensureUserProfile. Either is good enough.
      const hasName = cloudProfile?.displayName || user.displayName
      if (!hasName) setShowProfileSetup(true)
      return
    }
    // Guest path: only on initial page load, not after a mid-session sign-out.
    if (hadUser.current) return
    const p = getProfile()
    if (p?.username?.trim()) return
    const t = setTimeout(() => setShowProfileSetup(true), 600)
    return () => clearTimeout(t)
  }, [authLoading, user, cloudProfile])

  // If ProfileSetup opened before cloud profile arrived, close it once name is known.
  useEffect(() => {
    if (!showProfileSetup || !user) return
    const hasName = cloudProfile?.displayName || user.displayName
    if (hasName) setShowProfileSetup(false)
  }, [cloudProfile, user, showProfileSetup])

  // Cloud profile is the source of truth for signed-in display; persist to uid-specific cache.
  // Cloud wins when non-blank; existing uid cache fills any missing/blank cloud fields.
  // Guard: if the uid cache was saved more recently than the cloudProfile snapshot (captured
  // once at login by ensureUserProfile), the user manually updated via ProfileButton — keep it.
  useEffect(() => {
    if (!user || !cloudProfile) return
    const existing = getCachedAccountProfile(user.uid)
    if (existing?.updatedAt && cloudProfile?.lastSeenAt && existing.updatedAt > cloudProfile.lastSeenAt) {
      setProfile(existing)
      return
    }
    const mapped = {
      username: cloudProfile.displayName || existing?.username || '',
      avatarId: cloudProfile.avatarId || existing?.avatarId || 'cat',
      colorId: cloudProfile.colorId || existing?.colorId || 'peach',
    }
    saveCachedAccountProfile(user.uid, mapped)
    setProfile(mapped)
  }, [user, cloudProfile])

  // Resolves the freshest available identity for multiplayer player records.
  // Auth users: fresh Firebase read > uid cache > profile state. Guests: guest profile > random.
  async function resolveMultiplayerIdentity() {
    if (user?.uid) {
      try {
        const fresh = await getUserProfile(user.uid)
        if (fresh?.displayName?.trim()) {
          return { name: fresh.displayName.trim(), avatarId: fresh.avatarId || null, colorId: fresh.colorId || null }
        }
      } catch {}
      const cached = getCachedAccountProfile(user.uid)
      if (cached?.username?.trim()) {
        return { name: cached.username.trim(), avatarId: cached.avatarId ?? null, colorId: cached.colorId ?? null }
      }
      if (profile?.username?.trim()) {
        return { name: profile.username.trim(), avatarId: profile.avatarId ?? null, colorId: profile.colorId ?? null }
      }
    }
    const guestProfile = getProfile()
    return {
      name: guestProfile?.username?.trim() || getOrCreatePlayerName(),
      avatarId: guestProfile?.avatarId ?? null,
      colorId: guestProfile?.colorId ?? null,
    }
  }

  async function handleCreate() {
    logBetaEvent('flow_selected', { flow: 'together' })
    setCreating(true)
    setCreateError('')
    if (!navigator.onLine) {
      setCreateError("You're offline — check your connection and try again.")
      setCreating(false)
      return
    }
    try {
      const playerId = getOrCreatePlayerId()
      const { name: playerName, avatarId, colorId } = await resolveMultiplayerIdentity()
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Taking too long — check your connection and try again.')), 9000)
      )
      const code = await Promise.race([
        createSession(playerId, playerName, false, avatarId, colorId, user?.uid ?? null),
        timeout,
      ])
      navigate(`/session/${code}/lobby`)
    } catch (e) {
      setCreateError(e.message || 'Could not create room')
      setCreating(false)
    }
  }

  async function handleJoin() {
    const trimmed = joinCode.trim().toUpperCase()
    if (trimmed.length < 4) { setJoinError('Enter a valid code'); return }
    setJoining(true)
    setJoinError('')
    try {
      const playerId = getOrCreatePlayerId()
      const { name: playerName, avatarId, colorId } = await resolveMultiplayerIdentity()
      await joinSession(trimmed, playerId, playerName, avatarId, colorId, user?.uid ?? null)
      navigate(`/session/${trimmed}/lobby`)
    } catch (e) {
      setJoinError(e.message || 'Session not found')
      setJoining(false)
    }
  }

  async function handleSolo() {
    logBetaEvent('flow_selected', { flow: 'solo' })
    setSoloCreating(true)
    setSoloError('')
    if (!navigator.onLine) {
      setSoloError("You're offline — check your connection and try again.")
      setSoloCreating(false)
      return
    }
    try {
      const playerId = getOrCreatePlayerId()
      const playerName = getOrCreatePlayerName()
      const p = getProfile()
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Taking too long — check your connection and try again.')), 9000)
      )
      const code = await Promise.race([
        createSession(playerId, playerName, true, p?.avatarId ?? null, p?.colorId ?? null, user?.uid ?? null),
        timeout,
      ])
      navigate(`/session/${code}/pick`)
    } catch (e) {
      setSoloError(e.message || 'Could not start solo session')
      setSoloCreating(false)
    }
  }

  return (
    <motion.div
      className="relative min-h-screen bg-cream overflow-hidden flex flex-col items-center justify-center px-5 py-8 sm:py-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >

      {/* ── Background ambiance ──────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
        {/* Warm golden glow — top right */}
        <div
          className="absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255,189,80,0.26) 0%, rgba(255,155,46,0.10) 44%, transparent 70%)' }}
        />
        {/* Soft purple glow — top left */}
        <div
          className="absolute -top-20 -left-20 w-[340px] h-[340px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(162,110,255,0.18) 0%, rgba(124,62,250,0.07) 45%, transparent 70%)' }}
        />
        {/* Sky blue glow — bottom left */}
        <div
          className="absolute -bottom-24 -left-20 w-[380px] h-[380px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(74,158,255,0.20) 0%, rgba(37,99,235,0.08) 45%, transparent 70%)' }}
        />
        {/* Pink glow — bottom right */}
        <div
          className="absolute -bottom-16 -right-16 w-[280px] h-[280px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(236,110,170,0.14) 0%, transparent 68%)' }}
        />
        {/* Scattered paint-dot accents */}
        <svg className="absolute top-8 right-8 opacity-[0.12]" width="68" height="68" viewBox="0 0 68 68" fill="none">
          <circle cx="11" cy="11" r="9" fill="#FF9B2E" />
          <circle cx="50" cy="20" r="6" fill="#7C6EFA" />
          <circle cx="20" cy="54" r="7" fill="#4A9EFF" />
          <circle cx="57" cy="55" r="4.5" fill="#EC6EAA" />
        </svg>
        <svg className="absolute bottom-24 left-4 opacity-[0.10]" width="56" height="56" viewBox="0 0 56 56" fill="none">
          <circle cx="9" cy="9" r="8" fill="#FFD07A" />
          <circle cx="40" cy="16" r="5.5" fill="#7C6EFA" />
          <circle cx="16" cy="44" r="6.5" fill="#4A9EFF" />
        </svg>
      </div>

      {/* ── Desktop app shell — visible sm+ only, frames the content ──── */}
      <div
        className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[440px] pointer-events-none hidden sm:block"
        style={{
          zIndex: 1,
          background: 'rgba(255,252,248,0.14)',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.45), 0 0 60px rgba(255,255,255,0.12)',
          borderRadius: '0 0 36px 36px',
        }}
      />

      {/* ── Main content (above blobs) ───────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-[400px] flex flex-col items-center">

        {/* Profile button — top right */}
        {profile && (
          <div className="absolute top-0 right-0">
            <ProfileButton profile={profile} onProfileChange={setProfile} />
          </div>
        )}

        {/* ── Hero / Logo ─────────────────────────────────────────────────── */}
        <motion.div
          className="text-center mb-6"
          {...fadeUp(0)}
        >
          {/* Full logo — internal transparent padding pulls tagline close naturally */}
          <img
            src="/icons/colorsplit-logo-full.png"
            alt="ColorSplit"
            className="w-[164px] sm:w-[185px] select-none mx-auto"
            style={{ marginBottom: '-16px' }}
            draggable="false"
          />
          {/* Slogan — gradient words echo the logo split palette */}
          <p className="font-body text-[13px] font-semibold tracking-[0.015em] leading-snug" aria-label="Split the page. Share the magic.">
            <span style={{ background: 'linear-gradient(90deg,#8B6EF8,#4A9EFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Split the page.</span>
            <span className="text-ink/38"> · </span>
            <span style={{ background: 'linear-gradient(90deg,#EC6EAA,#FFB347)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Share the magic.</span>
          </p>
        </motion.div>

        {/* ── Cards ───────────────────────────────────────────────────────── */}
        <div className="w-full space-y-3">

          {/* Incoming friend invites */}
          <AnimatePresence>
            {invites.map(inv => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="w-full rounded-[22px] p-4 bg-white"
                style={{ border: '2px solid rgba(139,110,248,0.28)', boxShadow: '0 4px 18px rgba(139,110,248,0.14)' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-[44px] h-[44px] rounded-[14px] flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #EDE0FF 0%, #D5C8FF 100%)' }}
                  >
                    {/* Two-pencil icon — ColorSplit identity */}
                    <svg width="28" height="24" viewBox="0 0 32 28" fill="none" aria-hidden="true">
                      <rect x="1" y="1" width="13" height="19" rx="3.5" fill="#C4B5FD"/>
                      <rect x="1" y="1" width="13" height="5.5" rx="3.5" fill="rgba(255,255,255,0.55)"/>
                      <polygon points="1,20 7.5,27 14,20" fill="#EFC990"/>
                      <polygon points="4.5,23 7.5,27 10.5,23" fill="#8C7B75"/>
                      <rect x="19" y="1" width="12" height="19" rx="3.5" fill="#93C5FD"/>
                      <rect x="19" y="1" width="12" height="5.5" rx="3.5" fill="rgba(255,255,255,0.55)"/>
                      <polygon points="19,20 25,27 31,20" fill="#EFC990"/>
                      <polygon points="22,23 25,27 28,23" fill="#8C7B75"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-body font-bold text-ink text-[14px] leading-tight">
                      {inv.fromDisplayName} invited you to color!
                    </div>
                    <div className="text-ink/45 text-[12px] font-body">
                      Join their room and create something together
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDeclineInvite(inv)}
                    disabled={inviteBusy === inv.id}
                    className="flex-1 bg-white text-ink/55 font-semibold py-2.5 rounded-xl font-body text-sm border border-ink/10 active:scale-95 transition-transform disabled:opacity-50"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => handleJoinInvite(inv)}
                    disabled={!!inviteBusy}
                    className="flex-[2] text-white font-bold py-2.5 rounded-xl font-body text-sm active:scale-95 transition-transform shadow-lifted disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #8B6EF8 0%, #3B6CF6 100%)' }}
                  >
                    {inviteBusy === inv.id ? 'Joining…' : 'Join room →'}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {inviteError && (
            <p className="text-red-500 text-[13px] font-body text-center">{inviteError}</p>
          )}

          {/* Resume session banner */}
          <AnimatePresence>
            {resumeRoom && (
              <motion.button
                onClick={handleResume}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="w-full rounded-[22px] p-4 text-left bg-white active:scale-[0.98] transition-transform"
                style={{
                  border: '1px solid rgba(139,110,248,0.22)',
                  boxShadow: '0 2px 14px rgba(139,110,248,0.10), 0 0 0 1px rgba(139,110,248,0.06)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-[44px] h-[44px] rounded-[14px] flex items-center justify-center flex-shrink-0" style={{ background: '#EDE8FF' }}>
                    <svg width="24" height="22" viewBox="0 0 24 22" fill="none" aria-hidden="true">
                      <rect x="6" y="1" width="12" height="15" rx="3.5" fill="#C4B5FD"/>
                      <rect x="6" y="1" width="12" height="5" rx="3.5" fill="rgba(255,255,255,0.55)"/>
                      <polygon points="6,16 12,22 18,16" fill="#EFC990"/>
                      <polygon points="9,19 12,22 15,19" fill="#8C7B75"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-body font-bold text-ink text-[14px] leading-tight">
                      Continue coloring
                    </div>
                    <div className="text-ink/45 text-[12px] font-body">
                      Resume your unfinished artwork
                    </div>
                  </div>
                  <svg className="flex-shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9B89F0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </motion.button>
            )}
          </AnimatePresence>

          {/* Play Together — primary CTA */}
          <motion.button
            onClick={handleCreate}
            disabled={creating}
            className="w-full rounded-[24px] p-5 text-left relative overflow-hidden disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, #8B6EF8 0%, #3B6CF6 100%)',
              boxShadow: '0 10px 36px rgba(90,70,240,0.36), 0 2px 8px rgba(59,108,246,0.22)',
            }}
            {...fadeUp(0.08)}
            whileTap={{ scale: 0.97 }}
          >
            {/* Shine layer */}
            <div
              className="absolute inset-0 rounded-[24px] pointer-events-none"
              style={{ background: 'linear-gradient(140deg, rgba(255,255,255,0.20) 0%, transparent 52%)' }}
            />
            <div className="relative flex items-center gap-4">
              {/* Two-pencil icon */}
              <div
                className="w-[50px] h-[50px] rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.18)' }}
              >
                <svg width="32" height="27" viewBox="0 0 34 28" fill="none" aria-hidden="true">
                  <rect x="1" y="1" width="13" height="19" rx="3.5" fill="#C4B5FD"/>
                  <rect x="1" y="1" width="13" height="5.5" rx="3.5" fill="rgba(255,255,255,0.55)"/>
                  <polygon points="1,20 7.5,27 14,20" fill="#EFC990"/>
                  <polygon points="4.5,23 7.5,27 10.5,23" fill="#8C7B75"/>
                  <rect x="21" y="1" width="12" height="19" rx="3.5" fill="#93C5FD"/>
                  <rect x="21" y="1" width="12" height="5.5" rx="3.5" fill="rgba(255,255,255,0.55)"/>
                  <polygon points="21,20 27,27 33,20" fill="#EFC990"/>
                  <polygon points="24,23 27,27 30,23" fill="#8C7B75"/>
                </svg>
              </div>
              {/* Text */}
              <div className="flex-1 min-w-0">
                <div
                  className="text-white text-[19px] leading-tight mb-0.5"
                  style={{ fontFamily: "'Fredoka One', cursive" }}
                >
                  {creating ? 'Creating room…' : 'Color Together'}
                </div>
                <div className="text-white/72 text-[13px] font-body font-medium">
                  Everyone colors a secret piece — reveal together.
                </div>
              </div>
              {/* Chevron */}
              <svg className="text-white/40 flex-shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </motion.button>

          {/* Color Together error */}
          <AnimatePresence>
            {createError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-red-500 text-[13px] font-body text-center"
              >
                {createError}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Join with code */}
          <motion.div
            className="bg-white rounded-[24px] border p-4"
            style={{
              borderColor: 'rgba(45,36,22,0.07)',
              boxShadow: '0 2px 14px rgba(45,36,22,0.07), 0 0 0 1px rgba(45,36,22,0.04)',
            }}
            {...fadeUp(0.16)}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#FFF4B0,#FFE47A)' }}
              >
                <svg width="13" height="13" viewBox="0 0 16 14" fill="none" aria-hidden="true">
                  <rect x="0.75" y="1.75" width="5.5" height="10.5" rx="2" stroke="#B8860B" strokeWidth="1.5"/>
                  <path d="M8 7H15M11.5 4L15 7L11.5 10" stroke="#B8860B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-ink/55 text-[13px] font-bold font-body">Got a room code?</p>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={joinCode}
                onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError('') }}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                placeholder="ABC123"
                maxLength={8}
                className="min-w-0 flex-1 text-center text-[22px] tracking-[0.2em] bg-cream rounded-[14px] px-3 py-[10px] border-2 border-transparent focus:border-blue-400 outline-none transition-colors text-ink placeholder:text-ink/22"
                style={{ fontFamily: "'Fredoka One', cursive" }}
              />
              <button
                onClick={handleJoin}
                disabled={joining}
                className="flex-shrink-0 text-white font-bold px-5 py-[11px] rounded-[14px] text-[13px] font-body transition-all active:scale-95 disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #8B6EF8 0%, #3B6CF6 100%)',
                  boxShadow: '0 4px 14px rgba(90,70,240,0.28)',
                }}
              >
                {joining ? '…' : 'Join →'}
              </button>
            </div>
            <AnimatePresence>
              {joinError && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-500 text-[13px] font-body text-center mt-2.5"
                >
                  {joinError}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Secondary cards — 2-column grid */}
          <motion.div
            className="grid grid-cols-2 gap-3"
            {...fadeUp(0.24)}
          >
            {/* Play Solo */}
            <button
              onClick={handleSolo}
              disabled={soloCreating}
              className="bg-white rounded-[22px] p-4 text-left active:scale-95 transition-transform border disabled:opacity-60"
              style={{
                borderColor: 'rgba(45,36,22,0.06)',
                boxShadow: '0 2px 14px rgba(45,36,22,0.07), 0 0 0 1px rgba(45,36,22,0.04)',
              }}
            >
              <div
                className="w-[44px] h-[44px] rounded-[14px] flex items-center justify-center mb-3"
                style={{
                  background: 'linear-gradient(135deg, #FFF3D6 0%, #FFDC96 100%)',
                  boxShadow: '0 2px 8px rgba(255,155,46,0.22)',
                }}
              >
                <svg width="28" height="25" viewBox="0 0 32 28" fill="none" aria-hidden="true">
                  {/* Canvas */}
                  <rect x="14" y="3" width="17" height="22" rx="4" fill="rgba(255,255,255,0.90)" stroke="rgba(255,160,50,0.28)" strokeWidth="1.5"/>
                  {/* Single pencil */}
                  <rect x="1" y="1" width="11" height="19" rx="3" fill="#FBBF24"/>
                  <rect x="1" y="1" width="11" height="5.5" rx="3" fill="rgba(255,255,255,0.55)"/>
                  <polygon points="1,20 6.5,27 12,20" fill="#EFC990"/>
                  <polygon points="3.5,23 6.5,27 9.5,23" fill="#8C7B75"/>
                </svg>
              </div>
              <div className="font-body font-bold text-ink text-[14px] leading-tight mb-0.5">Solo</div>
              <div className="text-ink/40 text-[12px] font-body leading-tight">Relax with your own page</div>
            </button>

            {/* Gallery */}
            <button
              onClick={() => navigate('/gallery')}
              className="bg-white rounded-[22px] p-4 text-left active:scale-95 transition-transform border"
              style={{
                borderColor: 'rgba(45,36,22,0.06)',
                boxShadow: '0 2px 14px rgba(45,36,22,0.07), 0 0 0 1px rgba(45,36,22,0.04)',
              }}
            >
              <div
                className="w-[44px] h-[44px] rounded-[14px] flex items-center justify-center mb-3 overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #EDE0FF 0%, #D5C8FF 100%)',
                  boxShadow: '0 2px 8px rgba(139,110,248,0.26)',
                }}
              >
                <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                  {/* Premium frame — thicker border, warm fill */}
                  <rect x="0.5" y="0.5" width="27" height="27" rx="7" fill="#E8DCFF" stroke="#C4ABFF" strokeWidth="1.5"/>
                  {/* Inner mat (warm cream canvas) */}
                  <rect x="3.5" y="3.5" width="21" height="21" rx="4.5" fill="#FFFDF8"/>
                  {/* Art: three layered ColorSplit arcs */}
                  <path d="M6.5 21 Q14 8.5 21.5 21" stroke="#8B6EF8" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
                  <path d="M8.5 21 Q14 12 19.5 21" stroke="#4A9EFF" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
                  <path d="M10.5 21 Q14 15 17.5 21" stroke="#EC6EAA" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                  {/* Warm sun dot — top-left of canvas */}
                  <circle cx="6" cy="6.5" r="1.4" fill="#FFD07A" opacity="0.90"/>
                  {/* 4-pt sparkle — top-right on frame */}
                  <path d="M22.5 3 L23.3 5.2 L25 3 L23.3 0.8 Z" fill="#FFB347"/>
                </svg>
              </div>
              <div className="font-body font-bold text-ink text-[14px] leading-tight mb-0.5">Gallery</div>
              <div className="text-ink/40 text-[12px] font-body leading-tight">View your saved artworks</div>
            </button>
          </motion.div>

          {/* Solo error */}
          <AnimatePresence>
            {soloError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-red-500 text-[13px] font-body text-center"
              >
                {soloError}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Logged-out auth entry — returning users need a visible "log in" */}
          {authAvailable && !user && (
            <motion.button
              onClick={() => setShowAuth(true)}
              className="w-full text-center font-body text-[13px] font-semibold text-blue-500/90 py-2 active:scale-95 transition-transform"
              {...fadeUp(0.3)}
            >
              Log in or create account →
            </motion.button>
          )}

        </div>

        {/* ── Demo mode pill ──────────────────────────────────────────────── */}
        {DEMO_MODE && (
          <motion.div
            className="mt-6 flex items-center gap-2 rounded-full px-4 py-1.5 border"
            style={{
              background: 'rgba(219,234,254,0.65)',
              backdropFilter: 'blur(6px)',
              borderColor: 'rgba(147,197,253,0.6)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.44 }}
          >
            <div className="w-[6px] h-[6px] rounded-full bg-blue-400 flex-shrink-0" />
            <span className="text-blue-600 font-body text-[12px] font-semibold">
              Demo mode · Solo works fully
            </span>
          </motion.div>
        )}


      </div>

      {/* Profile setup (first launch) */}
      <AnimatePresence>
        {showProfileSetup && (
          <ProfileSetup
            onComplete={(p) => {
              setProfile(p)
              setShowProfileSetup(false)
            }}
          />
        )}
      </AnimatePresence>

      {/* Log in / create account sheet */}
      <AnimatePresence>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </AnimatePresence>
    </motion.div>
  )
}
