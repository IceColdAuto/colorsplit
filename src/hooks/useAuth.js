import { useEffect, useRef, useState } from 'react'
import {
  subscribeToAuth,
  completeEmailLinkSignIn,
  ensureUserProfile,
  ensureAnonymousAuth,
  isAuthAvailable,
} from '../lib/auth'

// Magic-link completion must run exactly once per page load, not once per
// hook mount (Home, Gallery and Reveal all use this hook).
let emailLinkHandled = false

/**
 * Auth state for components: { user, profile, loading, authAvailable }.
 * user     — Firebase user or null (guest)
 * profile  — /users/{uid} record (displayName, friendCode, …) or null
 */
export default function useAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(isAuthAvailable())
  const [profileLoading, setProfileLoading] = useState(false)

  const callIdRef = useRef(0)

  useEffect(() => {
    let cancelled = false

    async function init() {
      if (!emailLinkHandled) {
        emailLinkHandled = true
        try { await completeEmailLinkSignIn() } catch (e) {
          console.warn('Email link sign-in failed:', e?.code || e?.message)
        }
      }
    }

    const ready = init()
    const unsubscribe = subscribeToAuth(async (u) => {
      await ready
      if (cancelled) return
      // Stamp this auth event so any in-flight async from a prior event can detect it's stale.
      const callId = ++callIdRef.current

      // Anonymous Firebase users are an invisible implementation detail —
      // they exist only so session security rules have an auth.uid to check.
      // Treat them exactly like "no user" from the UI's perspective.
      const isAnonymous = u?.isAnonymous === true
      setUser(isAnonymous ? null : u)
      setProfile(null)

      if (u && !isAnonymous) {
        setProfileLoading(true)
        try {
          const p = await ensureUserProfile(u)
          if (!cancelled && callIdRef.current === callId) {
            setProfile(p)
            setProfileLoading(false)
          }
        } catch (e) {
          console.warn('Profile load failed:', e?.message)
          if (!cancelled && callIdRef.current === callId) {
            setProfile(null)
            setProfileLoading(false)
          }
        }
      } else {
        setProfileLoading(false)
        // No Firebase user at all — silently sign in anonymously so RTDB session
        // rules have an auth.uid. The resulting onAuthStateChanged fires again
        // with isAnonymous=true and is treated as no-user above.
        if (!u && !cancelled) ensureAnonymousAuth()
      }
      if (!cancelled && callIdRef.current === callId) setLoading(false)
    })

    return () => { cancelled = true; unsubscribe() }
  }, [])

  return { user, profile, loading, profileLoading, authAvailable: isAuthAvailable() }
}
