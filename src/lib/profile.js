const KEY = 'colorsplit_profile_v1'

export const AVATARS = [
  { id: 'cat',    emoji: '🐱', label: 'Cat'    },
  { id: 'fox',    emoji: '🦊', label: 'Fox'    },
  { id: 'bunny',  emoji: '🐰', label: 'Bunny'  },
  { id: 'bear',   emoji: '🐻', label: 'Bear'   },
  { id: 'panda',  emoji: '🐼', label: 'Panda'  },
  { id: 'frog',   emoji: '🐸', label: 'Frog'   },
  { id: 'owl',    emoji: '🦉', label: 'Owl'    },
  { id: 'star',   emoji: '⭐', label: 'Star'   },
]

export const AVATAR_COLORS = [
  { id: 'peach',    hex: '#FFE4B5', label: 'Peach'    },
  { id: 'rose',     hex: '#FFD4E8', label: 'Rose'     },
  { id: 'mint',     hex: '#C8F0DC', label: 'Mint'     },
  { id: 'sky',      hex: '#B8DEFF', label: 'Sky'      },
  { id: 'lavender', hex: '#E0D4FF', label: 'Lavender' },
  { id: 'lemon',    hex: '#FFF4B0', label: 'Lemon'    },
]

export function getProfile() {
  try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null }
}

export function saveProfile(profile) {
  localStorage.setItem(KEY, JSON.stringify({ ...profile, updatedAt: Date.now() }))
}

export function isProfileComplete() {
  const p = getProfile()
  return !!(p?.username?.trim())
}

export function clearProfile() {
  try { localStorage.removeItem(KEY) } catch {}
}

const accountKey = uid => `colorsplit_account_profile_${uid}`

export function getCachedAccountProfile(uid) {
  try { return JSON.parse(localStorage.getItem(accountKey(uid))) } catch { return null }
}

export function saveCachedAccountProfile(uid, profile) {
  localStorage.setItem(accountKey(uid), JSON.stringify({ ...profile, updatedAt: Date.now() }))
}

export function getDefaultProfileName() {
  const adj = ['Creative', 'Colorful', 'Dreamy', 'Playful', 'Artistic']
  const noun = ['Panda', 'Fox', 'Owl', 'Star', 'Bunny']
  return `${adj[Math.floor(Math.random() * adj.length)]} ${noun[Math.floor(Math.random() * noun.length)]}`
}
