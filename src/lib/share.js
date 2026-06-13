// Robust clipboard + native-share helpers.
//
// Why this exists: `navigator.clipboard.writeText()` and `navigator.share()`
// both reject in plenty of real situations (no focus, no permission, non-secure
// context, Safari quirks, user-gesture requirements). The old code wrapped them
// in empty `catch {}` blocks, so a failure produced *no feedback at all* — the
// button looked dead. These helpers always resolve to a known outcome so the UI
// can give clear feedback and fall back to manual copy.

const isDev = import.meta.env?.DEV

function devLog(...args) {
  if (isDev) console.log('[share]', ...args)
}

// Copy text to the clipboard. Tries the async Clipboard API, then a legacy
// execCommand textarea fallback (works in some browsers without focus/secure
// context). Returns true on success, false if every method failed.
export async function copyText(text) {
  // 1. Modern async clipboard API — needs secure context + focus + permission
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      devLog('clipboard.writeText OK')
      return true
    } catch (e) {
      devLog('clipboard.writeText failed:', e?.name, e?.message)
    }
  }
  // 2. Legacy execCommand fallback
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    devLog('execCommand copy:', ok)
    return ok
  } catch (e) {
    devLog('execCommand copy failed:', e?.message)
    return false
  }
}

// Share an invite link. Prefers the native share sheet (iOS/Android/PWA),
// falls back to clipboard copy, then to a "manual" signal so the caller can
// reveal the link for the user to copy by hand.
// Returns: 'shared' | 'copied' | 'manual'.
export async function shareInvite({ url, title, text }) {
  // 1. Native share sheet
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url })
      devLog('navigator.share resolved')
      return 'shared'
    } catch (e) {
      // User dismissing the sheet is not a failure — the sheet *did* open.
      if (e?.name === 'AbortError') {
        devLog('navigator.share aborted by user (sheet was shown)')
        return 'shared'
      }
      devLog('navigator.share failed, falling back to clipboard:', e?.name, e?.message)
    }
  }
  // 2. Clipboard fallback
  const copied = await copyText(url)
  if (copied) return 'copied'
  // 3. Manual fallback — caller should show the link
  devLog('all share/copy methods failed — manual fallback')
  return 'manual'
}
