import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import useAuth from '../hooks/useAuth'
import { signOutUser } from '../lib/auth'
import { addFriendByCode, subscribeToFriends, normalizeFriendCode } from '../lib/friends'
import { sendInvite } from '../lib/invites'
import { createSession, getOrCreatePlayerId, getOrCreatePlayerName } from '../lib/session'
import { copyText } from '../lib/share'
import { AVATAR_COLORS, getProfile } from '../lib/profile'
import AuthModal from './AuthModal'
import PencilTip from './PencilTip'

/**
 * Account block inside the profile sheet: log in / create account CTAs when
 * signed out; friend code, friends list (with per-friend session invites)
 * and sign-out when signed in.
 * Renders nothing in demo mode — accounts need Firebase.
 */
export default function AccountSection() {
  const navigate = useNavigate()
  const { user, profile, authAvailable } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  const [copied, setCopied] = useState(false)
  const [friends, setFriends] = useState([])
  const [friendInput, setFriendInput] = useState('')
  const [friendMsg, setFriendMsg] = useState(null) // { ok, text }
  const [adding, setAdding] = useState(false)
  const [invitingUid, setInvitingUid] = useState(null)

  useEffect(() => {
    if (!user) { setFriends([]); return }
    return subscribeToFriends(user.uid, setFriends)
  }, [user])

  // The current user must never appear in their own friends list — guard by
  // both auth uid and friend code (subscribeToFriends already drops uid
  // matches; this also covers a stale entry carrying my own friend code).
  const myFriends = friends.filter(
    f => f.uid !== user?.uid && (!profile?.friendCode || f.friendCode !== profile.friendCode),
  )

  if (!authAvailable) return null

  async function handleCopyCode() {
    if (!profile?.friendCode) return
    const ok = await copyText(profile.friendCode)
    setCopied(ok)
    setTimeout(() => setCopied(false), 1800)
  }

  async function handleAddFriend() {
    if (adding) return
    setAdding(true)
    setFriendMsg(null)
    try {
      const friend = await addFriendByCode(user.uid, profile, friendInput)
      setFriendMsg({ ok: true, text: `${friend.displayName} added! 🎉` })
      setFriendInput('')
    } catch (e) {
      setFriendMsg({ ok: false, text: e.message })
    }
    setAdding(false)
    setTimeout(() => setFriendMsg(null), 3500)
  }

  // "Invite to color" from the friend list: open a fresh together room, drop
  // the invite in the friend's inbox, and head to the lobby to wait for them.
  async function handleInviteFriend(friend) {
    // Defensive: the current user can never invite themselves.
    if (!friend?.uid || friend.uid === user?.uid) return
    if (invitingUid) return
    setInvitingUid(friend.uid)
    setFriendMsg(null)
    try {
      const playerId = getOrCreatePlayerId()
      const playerName = getOrCreatePlayerName()
      const p = getProfile()
      const code = await createSession(playerId, playerName, false, p?.avatarId ?? null, p?.colorId ?? null, user?.uid ?? null)
      await sendInvite({
        fromUid: user.uid,
        fromDisplayName: profile?.displayName || playerName,
        toUid: friend.uid,
        sessionCode: code,
      })
      navigate(`/session/${code}/lobby`)
    } catch (e) {
      setFriendMsg({ ok: false, text: e.message || 'Could not send the invite' })
      setInvitingUid(null)
      setTimeout(() => setFriendMsg(null), 3500)
    }
  }

  return (
    <>
      <p className="text-ink/40 text-xs font-bold uppercase tracking-wider font-body mb-2">Account</p>

      {!user ? (
        <div className="bg-white rounded-2xl p-4 border border-ink/8 mb-5">
          <p className="font-body text-sm text-ink/60 leading-relaxed mb-3">
            <strong className="text-ink/80">Guest mode</strong> — artworks are saved on this device only.
          </p>
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setShowAuth(true)}
              className="flex-1 bg-white text-blue-600 font-bold py-3 rounded-xl font-body text-sm border-2 border-blue-200 active:scale-95 transition-transform"
            >
              Log in
            </button>
            <button
              onClick={() => setShowAuth(true)}
              className="flex-1 bg-blue-500 text-white font-bold py-3 rounded-xl font-body text-sm active:scale-95 transition-transform shadow-lifted"
            >
              Create account
            </button>
          </div>
          <p className="text-ink/35 font-body text-[11px] text-center">
            Or just keep playing as a guest — no account needed.
          </p>
        </div>
      ) : (
        <div className="space-y-2 mb-5">
          {/* Signed-in identity */}
          <div className="bg-white rounded-2xl px-4 py-3 border border-ink/8 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-body font-bold text-ink text-sm truncate">
                {profile?.displayName || user.email || 'Signed in'}
              </div>
              <div className="text-ink/40 text-[11px] font-body truncate">
                {user.email || profile?.authProvider || ''}
              </div>
            </div>
            <button
              onClick={() => signOutUser()}
              className="flex-shrink-0 text-ink/45 font-body text-xs font-semibold px-3 py-2 rounded-xl bg-cream active:scale-95 transition-transform"
            >
              Sign out
            </button>
          </div>

          {/* Friend code */}
          <div className="bg-white rounded-2xl px-4 py-3 border border-ink/8 flex items-center justify-between gap-2">
            <div>
              <div className="text-ink/40 text-[11px] font-body font-bold uppercase tracking-wider">My friend code</div>
              <div className="font-mono font-bold text-ink text-lg tracking-[0.18em]">
                {profile?.friendCode || '······'}
              </div>
            </div>
            <button
              onClick={handleCopyCode}
              className="flex-shrink-0 bg-blue-50 text-blue-600 font-body text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-transform"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          {/* Friends */}
          <div className="bg-white rounded-2xl px-4 py-3 border border-ink/8">
            <div className="text-ink/40 text-[11px] font-body font-bold uppercase tracking-wider mb-2">
              Friends {myFriends.length > 0 && `(${myFriends.length})`}
            </div>
            {myFriends.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {myFriends.map(f => {
                  const col = AVATAR_COLORS.find(c => c.id === f.colorId) || AVATAR_COLORS[0]
                  return (
                    <div key={f.uid} className="flex items-center gap-2.5">
                      <span
                        className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
                        style={{ background: col.hex }}
                      >
                        <PencilTip size={22} />
                      </span>
                      <span className="font-body text-sm text-ink font-semibold truncate flex-1 min-w-0">{f.displayName || 'Friend'}</span>
                      <button
                        onClick={() => handleInviteFriend(f)}
                        disabled={!!invitingUid}
                        className="flex-shrink-0 bg-blue-50 text-blue-600 font-body text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform disabled:opacity-50"
                      >
                        {invitingUid === f.uid ? 'Inviting…' : '🎨 Invite'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={friendInput}
                onChange={e => { setFriendInput(normalizeFriendCode(e.target.value)); setFriendMsg(null) }}
                onKeyDown={e => e.key === 'Enter' && handleAddFriend()}
                placeholder="Friend code"
                maxLength={6}
                className="min-w-0 flex-1 font-mono text-sm tracking-[0.15em] bg-cream rounded-xl px-3 py-2.5 border-2 border-transparent focus:border-blue-400 outline-none transition-colors text-ink placeholder:text-ink/25 placeholder:font-body placeholder:tracking-normal"
              />
              <button
                onClick={handleAddFriend}
                disabled={adding}
                className="flex-shrink-0 bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-[13px] font-body active:scale-95 transition-transform disabled:opacity-50"
              >
                {adding ? '…' : 'Add'}
              </button>
            </div>
            {friendMsg && (
              <p className={`text-[12px] font-body mt-2 ${friendMsg.ok ? 'text-green-600' : 'text-red-500'}`}>
                {friendMsg.text}
              </p>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </AnimatePresence>
    </>
  )
}
