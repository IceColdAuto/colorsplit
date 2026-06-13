import { useEffect, useState } from 'react'
import {
  subscribeToAuth,
  completeEmailLinkSignIn,
  ensureUserProfile,
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
      setUser(u)
      if (u) {
        try {
          const p = await ensureUserProfile(u)
          if (!cancelled) setProfile(p)
        } catch (e) {
          console.warn('Profile load failed:', e?.message)
          if (!cancelled) setProfile(null)
        }
      } else {
        setProfile(null)
      }
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true; unsubscribe() }
  }, [])

  return { user, profile, loading, authAvailable: isAuthAvailable() }
}
