# Settings sync & backup

Everything configurable is persisted locally (localStorage) and, optionally,
synced across devices — with **no dedicated user-data backend**. One portable
snapshot, several interchangeable stores, last-write-wins.

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
  locally, so the post-reload run sees them equal and can't re-adopt — no
  session guard needed.
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
| Google Drive appDataFolder | users without Telegram | GIS OAuth (`drive.appdata`, non-sensitive) | the user's own Drive |
| Link / file export | everyone | none | wherever the user puts it |

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
is the control panel: Telegram sign-in (Login Widget), Google Drive
connect/disconnect, sync-now, copy-link, download/import file.

## Configuration (site, build-time, all optional)

- `NEXT_PUBLIC_TG_BOT_API_URL` — bot API base (also used by the Mini App
  profile sync; see docs/telegram-mini-app.md).
- `NEXT_PUBLIC_TG_BOT_USERNAME` — the bot's public username; enables the
  Login Widget on the plain site. One-time BotFather step: `/setdomain` to
  the site's domain.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — a Google OAuth **web** client id; enables
  Drive sync. Uses only the non-sensitive `drive.appdata` scope (basic OAuth
  verification, no security assessment). No secret — token requests run
  entirely client-side via Google Identity Services.

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

## Privacy notes

- Custom dates (birthdays, yahrzeits) ride in the blob; connecting a sync
  store uploads them to it. The link/file path keeps everything user-held.
- The Login Widget payload is a bearer credential in localStorage; it
  expires bot-side after 90 days and "Disconnect" drops it.
- Google tokens are ~1 h, memory-only; only a "connected" flag persists.
