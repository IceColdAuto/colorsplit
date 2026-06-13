/**
 * Cloud gallery — per-user persistent gallery at /users/{uid}/gallery/{id}.
 *
 * Realtime Database is the wrong long-term home for images, so cloud entries
 * store only a small JPEG thumbnail (~30–80 KB after re-compression) and the
 * artwork metadata — NOT the stroke replay data, which stays in the local
 * gallery. Firebase Storage is the documented next step for full-res images
 * (see FIREBASE_SETUP.md).
 */
import { db, DEMO_MODE } from './firebase'
import { ref, get, set, remove } from 'firebase/database'
import { loadGallery, compressImageDataUrl, markArtworkMigrated } from './gallery'

const CLOUD_THUMB_SIZE = 480
const CLOUD_THUMB_QUALITY = 0.7
// RTDB hard-caps strings at 10 MB, but anything near that is abusive for a
// gallery list — refuse thumbnails that somehow stay huge after compression.
const MAX_THUMB_BYTES = 300_000

export function isCloudGalleryAvailable() {
  return !DEMO_MODE && !!db
}

// RTDB paths reject . # $ [ ] / — local ids are `${code}_${timestamp}` so
// they're already safe, but sanitize anyway for pre-fix legacy ids.
function safeId(id) {
  return String(id).replace(/[.#$/[\]]/g, '_')
}

async function buildCloudEntry(entry) {
  const thumbnailData = entry.finalImageUrl
    ? await compressImageDataUrl(entry.finalImageUrl, CLOUD_THUMB_SIZE, CLOUD_THUMB_QUALITY)
    : null
  return {
    id: entry.id,
    sessionCode: entry.code || '',
    name: entry.name || 'My Artwork',
    pageId: entry.pageId || '',
    mode: entry.mode || 'solo',
    players: entry.players || [],
    playerCount: (entry.players || []).length || 1,
    savedByPlayerId: entry.savedByPlayerId || null,
    status: entry.status || 'completed',
    leftPlayerIds: entry.leftPlayerIds || [],
    completedAt: entry.completedAt || Date.now(),
    thumbnailData: thumbnailData && thumbnailData.length <= MAX_THUMB_BYTES ? thumbnailData : null,
  }
}

export async function saveArtworkToCloud(uid, entry) {
  if (!isCloudGalleryAvailable() || !uid || !entry?.id) return false
  const cloudEntry = await buildCloudEntry(entry)
  await set(ref(db, `users/${uid}/gallery/${safeId(entry.id)}`), cloudEntry)
  return true
}

// Returns cloud artworks shaped like local gallery entries (finalImageUrl
// aliased to the thumbnail) so GalleryScreen renders them unchanged.
export async function loadCloudGallery(uid) {
  if (!isCloudGalleryAvailable() || !uid) return []
  const snap = await get(ref(db, `users/${uid}/gallery`))
  if (!snap.exists()) return []
  return Object.values(snap.val())
    .map(e => ({ ...e, code: e.sessionCode || '', finalImageUrl: e.thumbnailData || null, cloud: true }))
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
}

export async function deleteCloudArtwork(uid, id) {
  if (!isCloudGalleryAvailable() || !uid || !id) return
  await remove(ref(db, `users/${uid}/gallery/${safeId(id)}`))
}

/**
 * Ownership gate for migration. An entry may move into `uid`'s account only
 * when ALL of these hold:
 *  - it was never migrated anywhere (migratedToUid stamp wins over everything —
 *    "migrate once" also blocks re-offering to a second account)
 *  - it isn't another account's local copy (saved while someone else was
 *    signed in on this device)
 *  - the account gallery doesn't already hold it
 * Legacy entries without ownership metadata count as guest-owned: they predate
 * accounts, and migration is always an explicit user action, never silent.
 */
function eligibleForMigration(entry, uid, existingCloud) {
  if (entry.migratedToUid) return false
  if (entry.localOwnerType === 'user' && entry.localOwnerId && entry.localOwnerId !== uid) return false
  if (existingCloud[safeId(entry.id)]) return false
  return true
}

/**
 * Copy local guest artworks into the account gallery. Local artworks are
 * never deleted — the local gallery keeps working as the device copy (and
 * still holds the replay strokes the cloud doesn't store). Each migrated
 * entry is stamped with migratedToUid so it is never offered again, not even
 * to a different account on this device.
 * Returns { migrated, skipped, failed }.
 */
export async function migrateGuestGalleryToCloud(uid) {
  const local = loadGallery()
  if (!isCloudGalleryAvailable() || !uid || local.length === 0) {
    return { migrated: 0, skipped: 0, failed: 0 }
  }
  const snap = await get(ref(db, `users/${uid}/gallery`))
  const existing = snap.exists() ? snap.val() : {}
  let migrated = 0, skipped = 0, failed = 0
  for (const entry of local) {
    if (!eligibleForMigration(entry, uid, existing)) {
      // Already in this account's cloud but missing its stamp (e.g. saved
      // while signed in by pre-stamp code) — stamp it now so it stays settled.
      if (!entry.migratedToUid && existing[safeId(entry.id)]) {
        markArtworkMigrated(entry.id, uid, entry.id)
      }
      skipped++
      continue
    }
    try {
      await saveArtworkToCloud(uid, entry)
      markArtworkMigrated(entry.id, uid, entry.id)
      migrated++
    } catch {
      failed++
    }
  }
  return { migrated, skipped, failed }
}

// How many local artworks the migration prompt should offer to this account.
export async function countUnmigratedLocalArtworks(uid) {
  const local = loadGallery()
  if (!isCloudGalleryAvailable() || !uid || local.length === 0) return 0
  const snap = await get(ref(db, `users/${uid}/gallery`))
  const existing = snap.exists() ? snap.val() : {}
  return local.filter(e => eligibleForMigration(e, uid, existing)).length
}
