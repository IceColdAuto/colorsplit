# Firebase Setup — Accounts, Gallery, Friends

What must be enabled in the Firebase Console (and Apple Developer) for the
account features added in the second pass. The code is already wired — until
a provider is enabled, its button shows "This sign-in method isn't enabled
yet" instead of crashing.

Project: `colorsplit-cef41` · Realtime Database (europe-west1)

## 1. Enable auth providers (Firebase Console → Authentication → Sign-in method)

> **First**: open the **Authentication** tab and click **Get started** — the
> project currently has Auth completely uninitialized (verified 2026-06-12:
> sign-in attempts return `auth/configuration-not-found`). Until this is done,
> every provider button shows "Accounts aren't set up yet" and guests are
> unaffected.

### Email magic link (preferred, required)
1. Enable **Email/Password** provider, then toggle **Email link (passwordless sign-in)** ON.
2. Under **Authentication → Settings → Authorized domains**, add every domain the app runs on:
   - `localhost` (usually present)
   - your Vercel domain(s), e.g. `colorsplit.vercel.app`
   - any Cloudflare tunnel domain used for device testing
3. The sign-in link redirects to `{origin}/` — SPA routing on Vercel already handles it ([vercel.json](vercel.json)).

#### Known issue: the sign-in email arrives as plain text / link not clickable
The app code is correct (`sendSignInLinkToEmail` with `handleCodeInApp: true`);
this is a Firebase Console / email-client issue, not a code bug. Checklist:

1. **Console → Authentication → Templates → "Email address sign-in"**: Firebase's
   default template sends an HTML email with a clickable link. If the template
   was customized into plain text or lost its `%LINK%` placeholder, revert to
   the default.
2. Firebase sends from `noreply@colorsplit-cef41.firebaseapp.com`. Some mail
   clients (corporate filters, some iOS Mail configurations) render
   unauthenticated senders as plain text and disable their links. The proper
   fix is a **custom sender domain** (Console → Templates → customize domain,
   needs DNS records) — it also improves deliverability.
3. The link target domain must be in **Authorized domains** (step 2 above);
   a missing domain fails at send time with `auth/unauthorized-continue-uri`.

Until the template/domain is fixed, users can copy the link text and paste it
into the browser — sign-in completes normally.

### Google Sign-In
1. Enable the **Google** provider (pick a support email). No other setup needed.
2. Same authorized-domains list applies.

### Apple Sign-In (most setup-heavy — can be done later)
> **Current state (June 2026):** the Apple button is **disabled in the UI**
> (" Apple · soon") because the provider isn't configured and a live-looking
> button that always fails is worse than an honest placeholder. The code path
> (`signInWithApple` in [src/lib/auth.js](src/lib/auth.js)) stays wired —
> after finishing the steps below, re-enable the button in
> [src/components/AuthModal.jsx](src/components/AuthModal.jsx).

1. Requires an Apple Developer account ($99/yr).
2. In Apple Developer: create an **App ID** + **Services ID**, enable "Sign in with Apple",
   set the return URL to `https://colorsplit-cef41.firebaseapp.com/__/auth/handler`,
   and create a **Sign in with Apple key** (.p8).
3. In Firebase Console: enable the **Apple** provider and paste the Services ID, team ID, key ID and key.

## 2. Deploy security rules

Rules live in [database.rules.json](database.rules.json). Deploy either way:

- **Console**: Realtime Database → Rules → paste the file's contents → Publish.
- **CLI**: `firebase deploy --only database` (needs `firebase.json` pointing at the rules file).

What the rules enforce:

| Path | Read | Write |
|---|---|---|
| `/sessions/{code}` | anyone | anyone |
| `/users/{uid}` | owner only | owner only |
| `/users/{uid}/displayName,avatarId,colorId,friendCode` | any signed-in user | owner only |
| `/users/{uid}/friends/{fuid}` | owner | owner, or the friend adding themselves |
| `/users/{uid}/gallery` | owner only | owner only |
| `/friendCodes/{code}` | any signed-in user | one-time claim by its own uid (no overwrite) |
| `/invites/{toUid}` | recipient only | sender creates (as self), recipient updates/deletes |

### Documented compromise: open sessions
`/sessions` stays world-read/write because **guest mode has no auth at all** —
guests join rooms via invite links with only a localStorage player id.
Risk: anyone with a room code can write into that room. Codes are 6 chars from
a 32-char alphabet (~1 billion combos) and rooms are short-lived, so this is
acceptable pre-launch but not forever.

**Recommended next step:** enable **Anonymous Authentication** and sign guests
in anonymously at app start. Then sessions can require `auth != null`, and
anonymous accounts can later be *upgraded* in place (linkWithCredential) which
would also make guest→account migration automatic. This is the single highest-
value security improvement available.

### In-app invite rules (implemented, third pass)
Invites use an **inbox model**: `/invites/{toUid}/{inviteId}`. The earlier
plan (flat `/invites` queried by `toUid`) doesn't survive contact with RTDB
security: rules are not filters, so querying a flat list would require
world-readable invites. With an inbox per user the rules are airtight:

| Action | Who |
|---|---|
| Read `/invites/{toUid}` | the recipient only |
| Create an invite | any signed-in user, but `fromUid` must be their own uid |
| Update (accept/decline/expire) or delete | the recipient only |

Enforced in [database.rules.json](database.rules.json), plus a `.validate`
that requires `fromUid/toUid/sessionCode/status/createdAt/expiresAt` and a
sane `status` value.

Documented MVP limitations:
- The sender can't read or rescind a sent invite (no sender-side "pending"
  state). Acceptable: invites expire after 30 minutes (client-enforced on
  read — RTDB has no TTL) and the lobby shows who actually joined.
- A recipient could technically edit other invite fields, not just `status`.
  Harmless today: the data only drives their own UI.
- The invited session itself is still world-writable (see "open sessions"
  above) — the invite gates discovery, not the room. The anonymous-auth pass
  below is the fix.

## 3. Recommended later: Firebase Storage for images

Cloud gallery entries currently store a ~480px JPEG thumbnail (~30–80 KB) as a
data URL in RTDB — deliberately conservative, since RTDB bills by stored bytes
and downloads the whole gallery node on read. Full-resolution images and stroke
replay data stay device-local. When galleries need full-res cloud images, move
image blobs to **Firebase Storage** (`users/{uid}/gallery/{id}.jpg`) and keep
only the download URL in RTDB.

## 4. Data model (as implemented)

```
/users/{uid}
  displayName, avatarId, colorId, friendCode, authProvider, createdAt, lastSeenAt
  /friends/{friendUid}  → { displayName, avatarId, colorId, friendCode, addedAt }
  /gallery/{artworkId}  → { id, sessionCode, name, pageId, mode, players[],
                            playerCount, savedByPlayerId, status, leftPlayerIds[],
                            completedAt, thumbnailData }
/friendCodes/{CODE}     → uid
/invites/{toUid}/{id}   → { fromUid, fromDisplayName, toUid, sessionCode, mode,
                            status: pending|accepted|declined|expired,
                            createdAt, expiresAt, respondedAt? }
/sessions/{code}        → unchanged from first pass
```

Artwork ids are canonical per round since the third pass: `{code}_{firstStrokeTs}`,
identical on every device, so the same account saving the same multiplayer round
from two devices overwrites one cloud entry instead of duplicating. Local gallery
entries additionally carry ownership metadata (`localOwnerType`, `localOwnerId`,
`migratedToUid`, `migratedAt`, `cloudArtworkId`) so guest artworks migrate to an
account exactly once and are never offered to a different account on the device.
