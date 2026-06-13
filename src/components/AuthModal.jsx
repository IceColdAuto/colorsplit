import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  signInWithGoogle,
  sendEmailLink,
  friendlyAuthError,
  isAuthAvailable,
} from '../lib/auth'

/**
 * Sign-in bottom sheet, used for BOTH logging in and creating an account —
 * Firebase providers make no distinction, so the copy says so explicitly.
 * Guest mode stays the default — this sheet only opens when the user taps an
 * account prompt, and closing it changes nothing.
 *
 * Apple sign-in is shown disabled ("soon"): the provider isn't configured in
 * the Firebase/Apple consoles yet (see FIREBASE_SETUP.md), and a live-looking
 * button that always fails is worse than an honest placeholder.
 *
 * Props:
 *   title    — optional heading override (used by contextual prompts)
 *   onClose  — dismiss without signing in
 *   onSignedIn — called after a popup provider succeeds (email link signs in
 *                on the return visit instead, handled by useAuth)
 */
export default function AuthModal({ title, onClose, onSignedIn }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(null) // null | 'email' | 'apple' | 'google'
  const [linkSent, setLinkSent] = useState(false)
  const [error, setError] = useState('')

  async function handleProvider(kind, fn) {
    setBusy(kind)
    setError('')
    try {
      await fn()
      onSignedIn?.()
      onClose()
    } catch (e) {
      const msg = friendlyAuthError(e)
      if (msg) setError(msg)
    }
    setBusy(null)
  }

  async function handleEmail() {
    const trimmed = email.trim()
    if (!trimmed.includes('@')) { setError('Enter a valid email address.'); return }
    setBusy('email')
    setError('')
    try {
      await sendEmailLink(trimmed)
      setLinkSent(true)
    } catch (e) {
      const msg = friendlyAuthError(e)
      if (msg) setError(msg)
    }
    setBusy(null)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-end bg-ink/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg bg-cream rounded-t-[32px] px-6 pt-5 pb-10"
      >
        <div className="w-10 h-1 bg-ink/15 rounded-full mx-auto mb-5" />

        <div className="flex justify-center mb-4">
          <img
            src="/icons/colorsplit-icon-mini.png"
            alt="ColorSplit"
            className="w-[52px] h-[52px] select-none"
            draggable="false"
          />
        </div>

        <h2 className="font-display text-2xl text-ink text-center mb-1" style={{ fontFamily: "'Fredoka One', cursive" }}>
          {title || 'Log in or create account'}
        </h2>
        <p className="text-ink/50 font-body text-sm text-center mb-6 leading-relaxed">
          New here? This creates your account. Coming back? Same buttons log you in.
          Free, no password needed.
        </p>

        {!isAuthAvailable() ? (
          <p className="text-ink/50 font-body text-sm text-center bg-white rounded-2xl p-4 border border-ink/8 mb-4">
            Accounts need Firebase configured. The app is running in demo mode.
          </p>
        ) : linkSent ? (
          <div className="bg-white rounded-2xl p-5 border border-ink/8 text-center mb-4">
            <div className="text-3xl mb-2">📬</div>
            <p className="font-body font-bold text-ink text-sm mb-1">Check your inbox!</p>
            <p className="text-ink/50 font-body text-[13px] leading-relaxed">
              We sent a sign-in link to <strong className="text-ink/70">{email.trim()}</strong>.
              Open it on this device to finish signing in.
            </p>
          </div>
        ) : (
          <>
            {/* Email magic link — primary */}
            <div className="bg-white rounded-2xl p-4 border border-ink/8 mb-3">
              <p className="text-ink/40 text-[11px] font-bold uppercase tracking-wider font-body mb-2">
                Sign in with email
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleEmail()}
                  placeholder="you@example.com"
                  className="min-w-0 flex-1 font-body text-[15px] bg-cream rounded-xl px-3 py-2.5 border-2 border-transparent focus:border-blue-400 outline-none transition-colors text-ink placeholder:text-ink/25"
                />
                <button
                  onClick={handleEmail}
                  disabled={busy === 'email'}
                  className="flex-shrink-0 bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-[13px] font-body active:scale-95 transition-transform disabled:opacity-50"
                >
                  {busy === 'email' ? '…' : 'Send link'}
                </button>
              </div>
            </div>

            {/* Google live · Apple disabled until configured in the consoles */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                onClick={() => handleProvider('google', signInWithGoogle)}
                disabled={!!busy}
                className="bg-white text-ink font-body font-semibold text-[14px] py-3.5 rounded-2xl border border-ink/10 active:scale-95 transition-transform disabled:opacity-50"
              >
                {busy === 'google' ? '…' : 'G Google'}
              </button>
              <button
                disabled
                className="bg-ink/10 text-ink/35 font-body font-semibold text-[14px] py-3.5 rounded-2xl cursor-default"
              >
                 Apple · soon
              </button>
            </div>
          </>
        )}

        {error && (
          <p className="text-red-500 text-[13px] font-body text-center mb-3">{error}</p>
        )}

        <button
          onClick={onClose}
          className="w-full text-ink/45 font-body text-sm py-3 active:scale-95 transition-transform"
        >
          Continue as guest
        </button>
        <p className="text-ink/30 font-body text-[11px] text-center">
          Guest artworks are saved on this device only.
        </p>
      </motion.div>
    </motion.div>
  )
}
