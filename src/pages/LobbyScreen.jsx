import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { subscribeToSession, updateSessionStatus, getOrCreatePlayerId, setupPresence, leaveRoom } from '../lib/session'
import { AVATAR_COLORS } from '../lib/profile'
import { copyText, shareInvite } from '../lib/share'
import useAuth from '../hooks/useAuth'
import { subscribeToFriends } from '../lib/friends'
import { sendInvite } from '../lib/invites'
import LeaveRoomModal from '../components/LeaveRoomModal'
import PencilTip from '../components/PencilTip'

// ─── Inline SVG icons ─────────────────────────────────────────────────────────

function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}

function IconSend() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function IconLink() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </svg>
  )
}

function IconSparkle() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2l2.09 6.43H21l-5.47 3.97 2.09 6.43L12 14.87l-5.62 3.96 2.09-6.43L3 8.43h6.91z" fill="#c084fc" opacity="0.75" />
    </svg>
  )
}

// ─── Pencil avatar ────────────────────────────────────────────────────────────

function PencilAvatar({ colorId, size = 32 }) {
  const col = AVATAR_COLORS.find(c => c.id === colorId) || AVATAR_COLORS[0]
  const tipSize = Math.round(size * 0.68)
  return (
    <div
      className="rounded-[10px] flex items-center justify-center flex-shrink-0 overflow-hidden"
      style={{ width: size, height: size, background: col.hex }}
    >
      <PencilTip size={tipSize} />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LobbyScreen() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [feedback, setFeedback] = useState(null) // null | { kind, msg }
  const [showManualLink, setShowManualLink] = useState(false)
  const playerId = getOrCreatePlayerId()
  const { user, profile } = useAuth()
  const [friends, setFriends] = useState([])
  const [invitedUids, setInvitedUids] = useState({}) // uid → 'sending' | 'sent' | 'failed'
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const leavingRef = useRef(false)

  useEffect(() => {
    if (!user) { setFriends([]); return }
    return subscribeToFriends(user.uid, setFriends)
  }, [user])

  // Build a set of auth UIDs currently active in the lobby so we can hide
  // friends who are already here from the invite list.
  const playerUids = new Set(
    Object.values(session?.players || {})
      .filter(p => p.name && !p.left && p.uid)
      .map(p => p.uid),
  )

  // Friends eligible to invite: not the current user, not already in the room.
  const invitableFriends = friends.filter(
    f =>
      f.uid !== user?.uid &&
      (!profile?.friendCode || f.friendCode !== profile.friendCode) &&
      !playerUids.has(f.uid),
  )

  const isHost = session?.hostId === playerId

  async function handleLeaveConfirm() {
    if (leavingRef.current) return
    leavingRef.current = true
    setShowLeaveConfirm(false)
    try { await leaveRoom(code, playerId) } catch {}
    navigate('/', { replace: true })
  }

  async function inviteFriendInApp(friend) {
    if (!friend?.uid || friend.uid === user?.uid) return
    if (invitedUids[friend.uid] === 'sending' || invitedUids[friend.uid] === 'sent') return
    setInvitedUids(s => ({ ...s, [friend.uid]: 'sending' }))
    try {
      await sendInvite({
        fromUid: user.uid,
        fromDisplayName: profile?.displayName || 'A friend',
        toUid: friend.uid,
        sessionCode: code,
      })
      setInvitedUids(s => ({ ...s, [friend.uid]: 'sent' }))
    } catch {
      setInvitedUids(s => ({ ...s, [friend.uid]: 'failed' }))
    }
  }

  const inviteUrl = `${window.location.origin}/join/${code}`

  function flashFeedback(kind, msg) {
    setFeedback({ kind, msg })
    setTimeout(() => setFeedback(f => (f?.kind === kind ? null : f)), 2600)
  }

  useEffect(() => setupPresence(code, playerId), [code, playerId])

  useEffect(() => {
    const unsub = subscribeToSession(code, (data) => {
      if (!data) return
      setSession(data)
      if (data.status === 'picking') navigate(`/session/${code}/pick`)
      if (data.status === 'settings') navigate(`/session/${code}/settings`)
      if (data.status === 'tearing') navigate(`/session/${code}/tear`)
      if (data.status === 'ready_check') navigate(`/session/${code}/ready`)
      if (data.status === 'coloring') navigate(`/session/${code}/color`)
    })
    return unsub
  }, [code])

  const players = session
    ? Object.entries(session.players || {}).filter(([, p]) => p.name && !p.left)
    : []
  const canStart = players.length >= 2

  async function handleStart() {
    await updateSessionStatus(code, 'picking')
    navigate(`/session/${code}/pick`)
  }

  async function copyCode() {
    const ok = await copyText(code)
    if (ok) flashFeedback('code', 'Room code copied')
    else flashFeedback('manual', 'Could not copy — tap the code to select it')
  }

  async function shareLink() {
    const result = await shareInvite({
      url: inviteUrl,
      title: 'ColorSplit',
      text: 'Come color with me on ColorSplit!',
    })
    if (result === 'shared') flashFeedback('shared', 'Share sheet opened')
    else if (result === 'copied') flashFeedback('link', 'Invite link copied')
    else { setShowManualLink(true); flashFeedback('manual', 'Could not copy link — tap to copy manually') }
  }

  async function copyLink() {
    const ok = await copyText(inviteUrl)
    if (ok) flashFeedback('link', 'Invite link copied')
    else { setShowManualLink(true); flashFeedback('manual', 'Could not copy link — tap to copy manually') }
  }

  function selectManualLink(e) {
    e.target.select()
    e.target.setSelectionRange(0, inviteUrl.length)
  }

  return (
    <motion.div
      className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 py-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="w-full max-w-sm">

        {/* Back */}
        <button
          type="button"
          onClick={() => setShowLeaveConfirm(true)}
          className="mb-4 inline-flex items-center gap-1.5 text-ink/50 font-body text-sm font-semibold active:scale-95 transition-transform"
          aria-label="Back to home"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-11 h-11 rounded-[13px] flex items-center justify-center overflow-hidden shadow-paper" style={{ background: '#FFD4E8' }}>
              <PencilTip size={30} />
            </div>
            <div className="w-11 h-11 rounded-[13px] flex items-center justify-center overflow-hidden shadow-paper" style={{ background: '#B8DEFF' }}>
              <PencilTip size={30} />
            </div>
          </div>
          <h1 className="font-display text-4xl text-ink mb-1" style={{ fontFamily: "'Fredoka One', cursive" }}>
            Waiting Room
          </h1>
          <p className="text-ink/50 font-body text-sm">Share the code or invite a friend.</p>
        </div>

        {/* Room code card */}
        <div className="bg-white rounded-3xl shadow-deep p-6 border border-ink/5 mb-4">
          <p className="text-ink/40 text-xs font-semibold uppercase tracking-wider font-body mb-1 text-center">
            Room Code
          </p>
          <div
            className="text-center font-display text-6xl tracking-widest text-blue-500 mb-4 select-all"
            style={{ fontFamily: "'Fredoka One', cursive" }}
          >
            {code}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyCode}
              className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-50 text-blue-600 font-semibold py-2.5 px-4 rounded-xl font-body text-sm active:scale-95 transition-all"
            >
              {feedback?.kind === 'code' ? (
                'Copied!'
              ) : (
                <><IconCopy /> Copy code</>
              )}
            </button>
            <button
              type="button"
              onClick={shareLink}
              className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-500 text-white font-semibold py-2.5 px-4 rounded-xl font-body text-sm active:scale-95 transition-all shadow-lifted"
            >
              {feedback?.kind === 'shared' ? 'Shared!' : feedback?.kind === 'link' ? 'Link copied!' : <><IconSend /> Invite</>}
            </button>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="w-full mt-2 inline-flex items-center justify-center gap-1.5 text-ink/45 font-body text-xs font-semibold py-1.5 active:scale-95 transition-transform"
          >
            {feedback?.kind === 'link' ? 'Invite link copied!' : <><IconLink /> Copy invite link</>}
          </button>

          {/* Feedback toast */}
          <AnimatePresence>
            {feedback && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`text-center font-body text-xs font-semibold mt-2 ${
                  feedback.kind === 'manual' ? 'text-amber-600' : 'text-green-600'
                }`}
              >
                {feedback.msg}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Manual fallback */}
          {showManualLink && (
            <div className="mt-2.5">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                onFocus={selectManualLink}
                onClick={selectManualLink}
                className="w-full text-center bg-cream rounded-xl px-3 py-2 border border-ink/15 text-ink text-xs font-body select-all outline-none focus:border-blue-400"
              />
              <p className="text-center text-ink/40 font-body text-[11px] mt-1">Tap the link, then copy it</p>
            </div>
          )}
        </div>

        {/* In-app friend invites — signed-in users only */}
        {user && (
          <div className="bg-white rounded-3xl shadow-paper p-5 border border-ink/5 mb-4">
            <p className="text-ink/40 text-xs font-semibold uppercase tracking-wider font-body mb-3">
              Invite a friend
            </p>
            {invitableFriends.length > 0 ? (
              <div className="space-y-2">
                {invitableFriends.map(f => {
                  const state = invitedUids[f.uid]
                  return (
                    <div key={f.uid} className="flex items-center gap-2.5">
                      <PencilAvatar colorId={f.colorId} size={32} />
                      <span className="font-body text-sm text-ink font-semibold truncate flex-1 min-w-0">
                        {f.displayName || 'Friend'}
                      </span>
                      <button
                        onClick={() => inviteFriendInApp(f)}
                        disabled={state === 'sending' || state === 'sent'}
                        className={`flex-shrink-0 font-body text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform ${
                          state === 'sent'
                            ? 'bg-green-50 text-green-600'
                            : state === 'failed'
                              ? 'bg-red-50 text-red-500'
                              : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        {state === 'sent' ? 'Invited' : state === 'sending' ? '…' : state === 'failed' ? 'Retry' : 'Invite'}
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : friends.length > 0 ? (
              <p className="text-ink/40 font-body text-sm text-center py-1">Everyone's already here!</p>
            ) : (
              <p className="text-ink/40 font-body text-sm text-center py-1">No friends yet. Add some in your profile.</p>
            )}
          </div>
        )}

        {/* Info card */}
        <div className="bg-white rounded-3xl shadow-paper p-4 border border-ink/5 mb-4">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 mt-0.5"><IconSparkle /></span>
            <p className="text-ink/55 font-body text-[13px] leading-relaxed">
              You'll each color a hidden part of the same page. When everyone is done, the full artwork is revealed.
            </p>
          </div>
        </div>

        {/* Players */}
        <div className="bg-white rounded-3xl shadow-paper p-5 border border-ink/5 mb-4">
          <p className="text-ink/40 text-xs font-semibold uppercase tracking-wider font-body mb-3">
            Players ({players.length})
          </p>
          <div className="space-y-2">
            {players.map(([pid, player]) => (
              <motion.div
                key={pid}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 py-2 px-3 bg-cream rounded-xl"
              >
                <PencilAvatar colorId={player.colorId} size={32} />
                <span className="font-semibold font-body text-ink text-sm">{player.name}</span>
                {pid === session?.hostId && (
                  <span className="ml-auto text-xs text-blue-500 font-semibold font-body bg-blue-50 px-2 py-0.5 rounded-lg">Host</span>
                )}
              </motion.div>
            ))}
            {players.length === 1 && (
              <div className="flex items-center gap-3 py-2 px-3 border-2 border-dashed border-ink/12 rounded-xl">
                <div className="w-8 h-8 rounded-[10px] border-2 border-dashed border-ink/20 flex items-center justify-center text-sm text-ink/30">?</div>
                <span className="text-ink/30 font-body text-sm">Waiting for player 2…</span>
              </div>
            )}
            {players.length >= 2 && players.length < 4 && (
              <div className="flex items-center gap-3 py-2 px-3 border-2 border-dashed border-ink/10 rounded-xl">
                <div className="w-8 h-8 rounded-[10px] border-2 border-dashed border-ink/15 flex items-center justify-center text-sm text-ink/25">+</div>
                <span className="text-ink/25 font-body text-sm">Room for {4 - players.length} more — or start now</span>
              </div>
            )}
          </div>
        </div>

        {/* Start / waiting */}
        {isHost ? (
          <button
            onClick={handleStart}
            disabled={!canStart}
            className="w-full bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lifted active:scale-95 transition-all font-body text-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {canStart ? 'Start Game' : 'Waiting for players…'}
          </button>
        ) : (
          <p className="text-center text-ink/40 font-body text-sm mt-2">
            Waiting for the host to start…
          </p>
        )}
      </div>

      <LeaveRoomModal
        showConfirm={showLeaveConfirm}
        onCancel={() => setShowLeaveConfirm(false)}
        onConfirm={handleLeaveConfirm}
        title="Leave this room?"
        subtitle={isHost
          ? "The room will close and you'll go back home."
          : "You'll leave this room and go back home."}
      />
    </motion.div>
  )
}
