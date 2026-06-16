/**
 * Auth service — single home for all Firebase Auth logic.
 *
 * Providers: email magic link (preferred), Apple, Google. Guest mode is NOT
 * an auth state — guests simply have no Firebase user, and the rest of the
 * app keeps working off the localStorage player id exactly as before.
 *
 * Every provider needs a Firebase Console toggle before it works in
 * production (see FIREBASE_SETUP.md). Until then sign-in attempts reject
 * with auth/operation-not-allowed, which friendlyAuthError() turns into a
 * readable message instead of a crash.
 */
import { app, db, DEMO_MODE } from './firebase'
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut as fbSignOut,
} from 'firebase/auth'
import { ref, get, set, update } from 'firebase/database'
import { getProfile, saveProfile, clearProfile } from './profile'

const EMAIL_FOR_SIGNIN_KEY = 'colorsplit_email_for_signin'

let authInstance = null

export function isAuthAvailable() {
  return !DEMO_MODE && !!app
}

function getAuthInstance() {
  if (!isAuthAvailable()) return null
  if (!authInstance) authInstance = getAuth(app)
  return authInstance
}

// ─── Auth state ───────────────────────────────────────────────────────────────

// Subscribe to sign-in state. In demo mode immediately reports "no user" and
// returns a no-op unsubscribe, so callers never need to special-case it.
export function subscribeToAuth(callback) {
  const auth = getAuthInstance()
  if (!auth) {
    callback(null)
    return () => {}
  }
  return onAuthStateChanged(auth, callback)
}

export function getCurrentUser() {
  return getAuthInstance()?.currentUser ?? null
}

export async function signOutUser() {
  const auth = getAuthInstance()
  if (auth) await fbSignOut(auth)
  clearProfile()
}

// ─── Providers ────────────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  const auth = getAuthInstance()
  if (!auth) throw new Error('Accounts need Firebase configured')
  const result = await signInWithPopup(auth, new GoogleAuthProvider())
  return result.user
}

export async function signInWithApple() {
  const auth = getAuthInstance()
  if (!auth) throw new Error('Accounts need Firebase configured')
  const provider = new OAuthProvider('apple.com')
  provider.addScope('email')
  provider.addScope('name')
  const result = await signInWithPopup(auth, provider)
  return result.user
}

// Send the magic link. The email is stashed in localStorage so the return
// visit (same device) can complete sign-in without retyping it.
export async function sendEmailLink(email) {
  const auth = getAuthInstance()
  if (!auth) throw new Error('Accounts need Firebase configured')
  await sendSignInLinkToEmail(auth, email, {
    url: `${window.location.origin}/`,
    handleCodeInApp: true,
  })
  try { localStorage.setItem(EMAIL_FOR_SIGNIN_KEY, email) } catch {}
}

// Called once on app start: if the current URL is a magic link, finish the
// sign-in and clean the URL. Returns the user, or null if this wasn't a
// magic-link visit. Cross-device opens (link tapped on a different device
// than the one that requested it) have no stored email, so we ask for it.
export async function completeEmailLinkSignIn() {
  const auth = getAuthInstance()
  if (!auth || !isSignInWithEmailLink(auth, window.location.href)) return null
  let email = null
  try { email = localStorage.getItem(EMAIL_FOR_SIGNIN_KEY) } catch {}
  if (!email) {
    email = window.prompt('Confirm your email to finish signing in')
    if (!email) return null
  }
  const result = await signInWithEmailLink(auth, email, window.location.href)
  try { localStorage.removeItem(EMAIL_FOR_SIGNIN_KEY) } catch {}
  // Strip oobCode etc. from the address bar
  window.history.replaceState({}, '', window.location.pathname)
  return result.user
}

// ─── User profile ─────────────────────────────────────────────────────────────

const FRIEND_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomFriendCode() {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += FRIEND_CODE_CHARS[Math.floor(Math.random() * FRIEND_CODE_CHARS.length)]
  }
  return code
}

// Claim a globally unique code under /friendCodes/{code} → uid.
// Tiny race window between get and set; security rules close it by only
// allowing writes to non-existent code slots.
export async function generateUniqueFriendCode(uid) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomFriendCode()
    const snap = await get(ref(db, `friendCodes/${code}`))
    if (!snap.exists()) {
      await set(ref(db, `friendCodes/${code}`), uid)
      return code
    }
  }
  throw new Error('Could not generate a friend code, please retry')
}

export async function getUserProfile(uid) {
  const snap = await get(ref(db, `users/${uid}`))
  return snap.exists() ? snap.val() : null
}

// Create the /users/{uid} profile on first sign-in, seeded from the local
// guest profile so the user keeps their name/avatar. Subsequent sign-ins
// only touch lastSeenAt — never overwrite what's already there.
export async function ensureUserProfile(user) {
  if (!user || !db) return null
  const userRef = ref(db, `users/${user.uid}`)
  const snap = await get(userRef)

  if (snap.exists()) {
    const profile = snap.val()
    const patch = { lastSeenAt: Date.now() }
    if (!profile.friendCode) {
      patch.friendCode = await generateUniqueFriendCode(user.uid)
    }
    await update(userRef, patch)
    const merged = { ...profile, ...patch }
    // Only write to localStorage if this user is still the active auth user.
    if (getAuthInstance()?.currentUser?.uid === user.uid) {
      const local = getProfile()
      if (!local?.username?.trim()) {
        saveProfile({ username: merged.displayName, avatarId: merged.avatarId || 'cat', colorId: merged.colorId || 'peach' })
      }
    }
    return merged
  }

  const local = getProfile()
  const displayName =
    local?.username?.trim() ||
    user.displayName ||
    (user.email ? user.email.split('@')[0] : 'Artist')
  const profile = {
    displayName,
    avatarId: local?.avatarId || 'cat',
    colorId: local?.colorId || 'peach',
    friendCode: await generateUniqueFriendCode(user.uid),
    authProvider: user.providerData?.[0]?.providerId || 'email-link',
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
  }
  await set(userRef, profile)
  // Only write to localStorage if this user is still the active auth user.
  if (getAuthInstance()?.currentUser?.uid === user.uid) {
    if (!local?.username?.trim()) {
      saveProfile({ username: profile.displayName, avatarId: profile.avatarId || 'cat', colorId: profile.colorId || 'peach' })
    }
  }
  return profile
}

export async function updateCloudDisplayName(uid, displayName) {
  if (!db || !uid || !displayName?.trim()) return
  await update(ref(db, `users/${uid}`), { displayName: displayName.trim() })
}

export async function updateCloudProfile(uid, { displayName, avatarId, colorId } = {}) {
  if (!db || !uid) return
  const patch = {}
  if (displayName?.trim()) patch.displayName = displayName.trim()
  if (avatarId) patch.avatarId = avatarId
  if (colorId) patch.colorId = colorId
  if (Object.keys(patch).length) await update(ref(db, `users/${uid}`), patch)
}

// ─── Error messages ───────────────────────────────────────────────────────────

// Returns a user-readable message, or null when the "error" is just the user
// closing the popup (not worth showing anything).
export function friendlyAuthError(e) {
  const code = e?.code || ''
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null
  if (code === 'auth/operation-not-allowed') {
    return 'This sign-in method isn’t enabled yet — try another option.'
  }
  if (code === 'auth/configuration-not-found') {
    return 'Accounts aren’t set up yet — you can keep playing as a guest.'
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This domain isn’t authorized for sign-in yet.'
  }
  if (code === 'auth/popup-blocked') {
    return 'Your browser blocked the sign-in popup. Allow popups and try again.'
  }
  if (code === 'auth/invalid-email') return 'That email address doesn’t look right.'
  if (code === 'auth/invalid-action-code') {
    return 'This sign-in link expired or was already used. Request a new one.'
  }
  if (code === 'auth/network-request-failed') return 'Network error — check your connection.'
  return e?.message || 'Sign-in failed. Please try again.'
}
