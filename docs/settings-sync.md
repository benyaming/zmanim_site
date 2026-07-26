# Settings sync & backup

Everything configurable is persisted locally (localStorage) and, optionally,
synced across devices. One portable snapshot, several interchangeable stores,
last-write-wins. On its own the site has **no user-data backend** — the stores
are the user's own accounts: Telegram (via `zmanim_bot`) or Google. Signing in
with Google syncs through the same `zmanim_bot` service, keyed to the account.

## The blob

`src/lib/sync/blob.ts` bundles the three persisted sections into one
versioned JSON value:

```jsonc
{
  "v": 2,
  "sections": {
    "prefs":    { "data": { /* zmanim:prefs:v1 — location, zmanim picks, custom dates, … */ }, "t": "2026-07-20T…" },
    "a11y":     { "data": { /* zmanim:a11y:v1 — text size, motion, contrast */ },              "t": "2026-07-20T…" },
    "theme":    { "data": "dark",  "t": "2026-07-20T…" }, // "light" / "system" / null
    "language": { "data": "he",    "t": "2026-07-20T…" }  // 'en' | 'he' | 'ru' | null
  }
}
```

This is **everything the user can configure**, split into independent
**sections that each carry their own timestamp `t`.** `prefs`, `a11y` and
`theme` are localStorage values copied verbatim. `language` is the odd one: it
lives in the URL (the next-intl locale), not localStorage — captured from
`<html lang>` and *applied by navigating* to that locale's path, not by a plain
reload (`reloadForSync`). Per-device flags (the Telegram/Google credentials,
the "seen the swipe hint" and "last release seen" dismissals) are deliberately
**not** in the blob.

The blob is **opaque to every store**: stores keep the bytes and never model
the sections. Content validation stays where it always was — the providers
sanitize whatever they load from localStorage — so adopting a section = write
its data back + reload. Per-section stamps live in `zmanim:sync-meta:v1`
(`{ prefs?, a11y?, theme?, language? }`); the prefs fingerprint the device last
agreed on lives in `zmanim:sync-synced:v1`.

### Reconcile rules (the load-bearing details)

- **Per-section merge, newest of each wins.** The reconcile merges every blob
  section-by-section — so changing the theme on one device can never revert
  the language set on another. (Whole-blob last-write-wins did exactly that;
  this shape is the fix.) On an *equal* section stamp a deterministic
  fingerprint tie-break picks the winner, so two diverged devices always
  converge instead of standing off.
- **Adopting is loop-safe.** Adopting a section copies its remote stamp
  locally, so the post-reload run normally sees them equal and can't re-adopt.
  The one place that invariant breaks is the Telegram Mini App: `TelegramMiniApp`
  re-applies the bot's *structured* location on every mount, which can disagree
  with the `web_prefs` blob and lose the fingerprint tie-break, so the reconcile
  re-adopts and reloads on a loop. A session guard (`consumeStartupReload`, a
  `sessionStorage` flag) caps the automatic startup reconcile to **one reload per
  tab session**; the residual difference then converges silently via the normal
  push. Manual "Sync now" and imports don't go through the guard.
- **Only *genuine* changes stamp a section.** Theme, a11y and language stamp
  their own section directly in their setter (they're always deliberate), so a
  lost debounced push can't strand them at an equal stamp. The prefs section is
  stamped by the change watcher, which fires only when the freshly persisted
  prefs differ from `zmanim:sync-synced:v1` — so mount-time auto-detect /
  elevation / relabel churn doesn't re-stamp prefs and clobber another device.
- **The prefs fingerprint drops the location's `label`/`labelLocale`** — they're
  derived by per-device, per-language reverse geocoding (the same place reads
  "Petah Tikva" / "Петах-Тиква" / "פתח תקווה"), so keeping them would make two
  devices in one place sync forever. Coordinates, elevation, timezone and any
  user `customLabel` still count.
- **Legacy v1 blobs migrate on read** — each field becomes a section sharing
  the old single `updatedAt`.
- **Sync happens on load and on change, not live.** A change on device A shows
  on device B when B next loads (or hits "Sync now"), not while B sits open.

## Stores

| Store | Who | Auth | Where the data lives |
| --- | --- | --- | --- |
| Telegram CloudStorage | Mini App users (Bot API 6.9+) | implicit | Telegram's own per-user KV store |
| Bot Mongo (`web_prefs`) | Mini App **and** site users with Telegram | initData / Login Widget payload | `zmanim_bot`'s user document |
| Bot Mongo (`web_sync`) | site users without Telegram, via Google | Google key + signature | `zmanim_bot`'s `web_sync` collection |
| Link / file export | everyone | none | wherever the user puts it |

**Sign in with Google** (`src/lib/google/web-login.ts`) is the second account
path next to the Telegram Login Widget. It is a **plain-website** feature (gated
off inside the Mini App, where the bot is already the store via initData) and
it uses GIS's **ID-token** flow, not the access-token flow.

Why not Google Drive, which an earlier version used: a browser is never issued
a refresh token, and minting a Google **access** token always shows UI, so
Drive-in-the-browser popped a window on **every page load** — a daily visitor
faced a popup every visit (third-party-cookie blocking killed the old silent
hidden-iframe renewal). There is no client-side fix; the token lifetime is
Google's. So the store moved to the bot and Google became identity-only.

The flow, end to end:

1. The user clicks Google's rendered sign-in button (the one Google UI, at
   sign-in). GIS returns a signed **ID token** (a JWT) — no access token, no
   scopes, no Drive.
2. The site POSTs that JWT once to the bot's `/google-key`. The bot verifies it
   (`aud` = our client id, issuer, expiry, `email_verified`), looks the account
   up by a one-way hash of its `sub`, and returns that account's `key` — a
   **random, stored** value, minted once and reused for every device/sign-in —
   plus a `sig` = `HMAC(bot_token, key)`, along with the display profile
   (name / email / avatar).
3. The site stores `{key, sig, …profile}` in `zmanim:google-account:v2` and
   **never contacts Google again**. Syncs are plain POSTs to the bot's
   `/websync` carrying `key` + `sig`; the `sig` authenticates them, so the
   store can be public without letting anyone create rows (see the bot's
   `miniapp/api.py`). The bot reads the id/email from the token only to verify
   it and never stores them — it keeps only the derived account hash.

Because the `key` is stored (not derived from the bot token), it **survives a
bot-token rotation**: a rotation invalidates the token-derived `sig`, so the
next `/websync` 401s and the device must re-sign-in — but `/google-key` returns
the same key, so the data is intact (Telegram parity: re-auth, never loss).

So after sign-in there is **no Google interaction at all** — no token to renew,
nothing to pop up, on any load or tab. The profile fields are display-only and
live on the device; the settings blob lives in the bot's `web_sync` collection,
keyed by `key`.

The bot's Mongo is the authoritative store for Telegram users — **all**
configurable things land there as the `web_prefs` blob (on top of the three
structured fields the bot itself models: location, cl_offset,
havdala_opinion, which keep their existing two-way sync and chat
confirmations).

## Engine

`src/lib/sync/engine.ts`, mounted app-wide by
`src/components/providers/settings-sync.tsx`:

- **On load**: pull every connected store; if the newest remote beats the
  local stamp *and differs in content*, apply it and reload once (a
  sessionStorage guard makes reload loops impossible). Otherwise push the
  local blob to any store that's absent or stale.
- **On change**: any synced setting changing stamps `updatedAt` and pushes
  the fresh localStorage snapshot to all stores, debounced (the providers'
  own persist effects run first, so the pushed blob is never stale).
- **Import** (link `#settings=…` or file): asks first, then applies with a
  fresh stamp so the import wins everywhere on the next sync.

The Sync & backup tool (Tools menu, `src/components/tools/sync-backup.tsx`)
is the control panel: Telegram sign-in (Login Widget), Sign in with Google,
sync-now, sign-out, copy-link, download/import file.

## Configuration (site, build-time, all optional)

- `NEXT_PUBLIC_TG_BOT_API_URL` — bot API base (also used by the Mini App
  profile sync; see docs/telegram-mini-app.md).
- `NEXT_PUBLIC_TG_BOT_USERNAME` — the bot's public username; enables the
  Login Widget on the plain site. One-time BotFather step: `/setdomain` to
  the site's domain.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — a Google OAuth **web** client id; enables
  Sign in with Google. The **ID-token** flow is used (identity only, no scopes,
  no Drive), so there is no consent-screen scope review — but the site's origin
  must be listed under the client's **Authorized JavaScript origins**. Requires
  `NEXT_PUBLIC_TG_BOT_API_URL` too: the bot verifies the token and stores the
  settings, so Google login does nothing without it. The bot needs the same id
  in its `GOOGLE_CLIENT_ID` to check the token's `aud`, and — if it sits behind
  a reverse proxy that overwrites `X-Forwarded-For` — `TRUST_PROXY_HEADERS=true`
  so the sync endpoints' per-IP rate limit keys on the real client, not the
  proxy (default off uses the socket peer, which can't be spoofed).

Unset = the corresponding section simply doesn't render; link/file transfer
always works.

## Bot API contract (zmanim_bot)

`/me` and `/sync` accept either credential:

- `init_data` — Mini App initData string (unchanged).
- `auth_data` — Login Widget payload `{id, first_name?, last_name?,
  username?, photo_url?, auth_date, hash}`, validated per
  https://core.telegram.org/widgets/login#checking-authorization with a
  90-day `auth_date` window (`miniapp/auth.py::validate_login_widget`).

`/sync` additionally takes `web_prefs` (string ≤ 64 KiB, must parse as
JSON, stored verbatim on the user document); `/me` and `/sync` responses
include it. Blob-only syncs don't trigger the chat confirmation message —
only the structured fields do.

For website users **without** Telegram, two more endpoints back Sign in with
Google (no `User` document; own `web_sync` collection):

- `/google-key` — `{credential}` (a Google ID token) → `{key, sig, email,
  name, picture}`. Verifies the token and returns the sync credential; the
  Google id is never stored.
- `/websync` — `{key, sig, web_prefs?}` → `{web_prefs}`. `sig` =
  `HMAC(bot_token, key)` authenticates the call, so only keys the bot issued
  can read or create a row. Sending `web_prefs` stores it (atomic upsert);
  omitting it reads. Both endpoints are per-IP rate-limited; abandoned rows
  carry a TTL.

## Privacy notes

- Custom dates (birthdays, yahrzeits) ride in the blob; connecting a sync
  store uploads them to it. The link/file path keeps everything user-held.
- The Login Widget payload is a bearer credential in localStorage; it
  expires bot-side after 90 days and "Disconnect" drops it.
- Google sign-in holds no access token at all — only the bot sync credential
  (`key` + `sig`) and the display profile, in `zmanim:google-account:v2`. The
  settings blob lives in the bot's `web_sync` collection, keyed by `key`.
  "Sign out" drops the local record (and clears the old Drive-flow keys) and
  stops Google auto-select.
