/**
 * Friends MVP — add by friend code, mutual list, no search/chat/profiles.
 *
 * /friendCodes/{code}            → uid   (claimed at sign-up, never reused)
 * /users/{uid}/friends/{fuid}    → { displayName, avatarId, colorId, friendCode, addedAt }
 *
 * Adding writes BOTH sides so each user sees the other. Security rules allow
 * writing yourself into someone else's friends list (see database.rules.json
 * for the documented trade-off).
 */
import { db, DEMO_MODE } from './firebase'
import { ref, get, update, onValue, off } from 'firebase/database'

export function normalizeFriendCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * Add a friend by their code. Throws Error with a user-readable message:
 * not found / yourself / already friends.
 */
export async function addFriendByCode(myUid, myProfile, rawCode) {
  if (DEMO_MODE || !db) throw new Error('Friends need Firebase configured')
  const code = normalizeFriendCode(rawCode)
  if (code.length < 6) throw new Error('Enter a 6-character friend code')

  const codeSnap = await get(ref(db, `friendCodes/${code}`))
  if (!codeSnap.exists()) throw new Error('No one has that friend code')
  const friendUid = codeSnap.val()
  if (friendUid === myUid) throw new Error('That’s your own code!')

  const alreadySnap = await get(ref(db, `users/${myUid}/friends/${friendUid}`))
  if (alreadySnap.exists()) throw new Error('You’re already friends')

  // Per-field reads: security rules expose only these public profile fields
  // to other users — reading the whole /users/{uid} node would be denied.
  const [nameSnap, avatarSnap, colorSnap, codeSnap2] = await Promise.all([
    get(ref(db, `users/${friendUid}/displayName`)),
    get(ref(db, `users/${friendUid}/avatarId`)),
    get(ref(db, `users/${friendUid}/colorId`)),
    get(ref(db, `users/${friendUid}/friendCode`)),
  ])
  if (!nameSnap.exists()) throw new Error('No one has that friend code')
  const friend = {
    displayName: nameSnap.val(),
    avatarId: avatarSnap.val(),
    colorId: colorSnap.val(),
    friendCode: codeSnap2.val(),
  }

  const now = Date.now()
  await update(ref(db), {
    [`users/${myUid}/friends/${friendUid}`]: {
      displayName: friend.displayName || 'Artist',
      avatarId: friend.avatarId || 'cat',
      colorId: friend.colorId || 'peach',
      friendCode: friend.friendCode || code,
      addedAt: now,
    },
    [`users/${friendUid}/friends/${myUid}`]: {
      displayName: myProfile?.displayName || 'Artist',
      avatarId: myProfile?.avatarId || 'cat',
      colorId: myProfile?.colorId || 'peach',
      friendCode: myProfile?.friendCode || '',
      addedAt: now,
    },
  })
  return { uid: friendUid, displayName: friend.displayName || 'Artist' }
}

// Live friends list as [{ uid, displayName, … }] sorted by name.
//
// Defensive guarantees:
//  - The current user is never returned in their own friends list (a self
//    entry must never be inviteable). We filter `fuid === uid` structurally.
//  - A friend with a missing/blank displayName is still returned (with the
//    name left as-is); the UI shows a "Friend" fallback rather than hiding a
//    valid friendship.
//  - If the read is denied or errors, we report an empty list instead of
//    silently leaving stale state, and log it for debugging.
export function subscribeToFriends(uid, callback) {
  if (DEMO_MODE || !db || !uid) {
    callback([])
    return () => {}
  }
  const r = ref(db, `users/${uid}/friends`)
  onValue(
    r,
    async snap => {
      const val = snap.val() || {}
      const entries = Object.entries(val).filter(([fuid]) => fuid && fuid !== uid)

      // Hydrate each friend from their live public profile fields.
      // Security rules only expose individual fields, not the full node.
      const hydrated = await Promise.all(
        entries.map(async ([fuid, stored]) => {
          try {
            const [nameSnap, avatarSnap, colorSnap] = await Promise.all([
              get(ref(db, `users/${fuid}/displayName`)),
              get(ref(db, `users/${fuid}/avatarId`)),
              get(ref(db, `users/${fuid}/colorId`)),
            ])
            return {
              uid: fuid,
              ...stored,
              displayName: nameSnap.val() || stored.displayName || 'Friend',
              avatarId: avatarSnap.val() || stored.avatarId || 'cat',
              colorId: colorSnap.val() || stored.colorId || 'peach',
            }
          } catch {
            // Fallback to stored snapshot if live read fails
            return { uid: fuid, ...stored }
          }
        }),
      )

      const list = hydrated.sort((a, b) =>
        (a.displayName || '').localeCompare(b.displayName || ''),
      )
      callback(list)
    },
    err => {
      console.warn('[ColorSplit] friends read failed:', err?.message || err)
      callback([])
    },
  )
  return () => off(r)
}
