/**
 * In-app friend invites MVP — invite a friend to a coloring session.
 *
 * Inbox model: /invites/{toUid}/{inviteId}. RTDB security rules can't filter
 * a query per-record (a flat /invites list would need world-read to query by
 * toUid), so each user owns their inbox: only the recipient can read it, and
 * anyone signed in can append an invite that names themselves as sender.
 * See database.rules.json.
 *
 * Invite: { fromUid, fromDisplayName, toUid, sessionCode, mode,
 *           status: pending|accepted|declined|expired, createdAt, expiresAt }
 *
 * No push notifications — the recipient sees pending invites on the home
 * screen while the app is open. Invites expire after 30 minutes; expiry is
 * enforced client-side on read (recipient filters them out) since RTDB has
 * no server-side TTL.
 */
import { db, DEMO_MODE } from './firebase'
import { ref, push, set, update, onValue, off } from 'firebase/database'

export const INVITE_TTL_MS = 30 * 60 * 1000

export function isInvitesAvailable() {
  return !DEMO_MODE && !!db
}

export async function sendInvite({ fromUid, fromDisplayName, toUid, sessionCode, mode = 'together' }) {
  if (!isInvitesAvailable()) throw new Error('Invites need Firebase configured')
  if (!fromUid || !toUid || !sessionCode) throw new Error('Missing invite details')
  const inviteRef = push(ref(db, `invites/${toUid}`))
  const now = Date.now()
  await set(inviteRef, {
    fromUid,
    fromDisplayName: fromDisplayName || 'A friend',
    toUid,
    sessionCode,
    mode,
    status: 'pending',
    createdAt: now,
    expiresAt: now + INVITE_TTL_MS,
  })
  return inviteRef.key
}

// Live list of this user's pending, unexpired invites, newest first.
export function subscribeToIncomingInvites(uid, callback) {
  if (!isInvitesAvailable() || !uid) {
    callback([])
    return () => {}
  }
  const r = ref(db, `invites/${uid}`)
  onValue(r, snap => {
    const val = snap.val() || {}
    const now = Date.now()
    const list = Object.entries(val)
      .map(([id, inv]) => ({ id, ...inv }))
      .filter(inv => inv.status === 'pending' && (inv.expiresAt || 0) > now)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    callback(list)
  }, () => callback([]))
  return () => off(r)
}

// status: 'accepted' | 'declined' | 'expired' — recipient-only by the rules.
export async function respondToInvite(toUid, inviteId, status) {
  if (!isInvitesAvailable() || !toUid || !inviteId) return
  await update(ref(db, `invites/${toUid}/${inviteId}`), {
    status,
    respondedAt: Date.now(),
  })
}
