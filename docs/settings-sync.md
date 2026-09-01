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
reload (`reloadForSync`). Inside the **Mini App** the language is **passive**:
Telegram relaunches the app at the bot-language path (`/he`|`/ru`) on every
open, so the URL locale is the bot's, not the user's — the local side
contributes no language to the merge (the blob's value rides through intact)
and a remote language is never adopted (adopting navigates, i.e. visibly
restarts the webview on every open). An explicit in-session pick (dirty) still
propagates. Per-device flags (the Telegram/Google credentials,
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
  this shape is the fix.) On an *equal* section stamp — two versions claiming
  the same moment, with no history to order them — the side carrying **more
  irreplaceable user content** wins (personal-date people and occasions, saved
  locations: `userItemCount`), and only then does a deterministic fingerprint
  tie-break decide, so two diverged devices always converge instead of standing
  off. Content beats fingerprint order because fingerprint order is content
  sorting, i.e. a coin flip, and losing it costs data that exists nowhere else;
  a genuine deletion always bumps the stamp, so a side that is poorer *at an
  equal stamp* is never someone's deliberate delete — it is a copy that never
  had the data.
- **Adopting is loop-safe.** Adopting a section copies its remote stamp
  locally, so the post-reload run normally sees them equal and can't re-adopt.
  The place that invariant used to break was the Telegram Mini App, which wrote
  the bot's location into prefs at every mount — first via `TelegramMiniApp`
  re-applying the bot's *structured* location, later via the personalized
  launch URL's `?lat=&lng=` deep link being persisted over the saved location.
  Either could disagree with the `web_prefs` blob and lose (or trail) the
  merge, so the reconcile re-adopted and reloaded on every launch — each
  launch is a fresh webview session, so the session cap below reset every
  time. Both drivers are gone: the bot's location only seeds a device that has
  none, and a deep-link location is **session-only** — shown for the session,
  never persisted (the saved location rides through prefs verbatim; see
  `app-state.tsx`). The guard stays, since any future mount-time write would
  reopen it. A session guard (`consumeStartupReload`, a
  `sessionStorage` flag) caps the automatic startup reconcile to **one reload per
  tab session**; the residual difference then converges silently via the normal
  push. Manual "Sync now" and imports don't go through the guard.
- **Connecting an account never silently overwrites its stored settings.**
  Stamps only order edits within one account's history, so comparing them
  across accounts is meaningless — without a guard, signing in right after
  using another account (or none) would push this device's leftovers over the
  account's data. A lineage record (`zmanim:sync-lineage:v1`, store → account
  id) tracks which account each store last reconciled with; sign-out clears it.
  On a mismatch the store is **quarantined** — not merged from, not pushed to
  (including the debounced change push) — until the reconcile is lossless or
  the user chooses. Empty store → local seeds it; equal content or a
  section-disjoint blob → merges silently (and "the account wins" is literal:
  a section the gate judged as having nothing to lose is **dropped from the
  local side of the merge**, so the account's copy takes it by presence. Leaving
  it to the equal-stamp fingerprint tie-break caused real data loss — both sides
  commonly sit at the EPOCH, since prefs is stamped only on a genuine edit, and
  whenever the device's mount-written defaults happened to sort higher they were
  pushed over the account's settings, personal dates and all, with no dialog);
  both sides holding real, differing
  data → a dialog asks which side wins ("use account" re-pulls the store —
  the snapshot behind a long-open dialog may be stale — and adopts every
  section the account holds *now*; a failed re-pull aborts the choice rather
  than adopt a stale snapshot; "keep device" re-stamps local as a fresh edit).
  Lineage is only ever recorded once a run (or choice) settles — recording is
  what re-enables blind pushes, so doing it mid-run would let the debounced
  change push race the merge. Either choice resolves ONE account per dialog —
  conflicts from a second account (stamps across accounts are incomparable)
  resurface on the next run. "Real" local data means a section stamped on
  this device: one still at the EPOCH (the URL-derived default language, a
  blank device) has nothing to lose, so the account's copy wins silently —
  unless content vouches for it, covering pre-v1.22 devices whose choices
  carry no stamp: prefs via `prefsHoldUserData` (web only — the Mini App
  seeds the bot's location into prefs on a device that has none), a11y via non-default
  values (`a11yHoldsUserData`), theme by mere presence (it is only ever
  persisted by an explicit pick). Mount-written defaults and the URL language
  never count, keeping fresh devices silent.
- **Only *genuine* changes stamp a section.** Theme, a11y and language stamp
  their own section directly in their setter (they're always deliberate), so a
  lost debounced push can't strand them at an equal stamp. The prefs section is
  stamped by the change watcher, which fires only when the freshly persisted
  prefs differ from `zmanim:sync-synced:v1` — so mount-time auto-detect /
  elevation / relabel churn doesn't re-stamp prefs and clobber another device.
- **Fingerprints are canonical: content identity, not byte identity.** A
  section's fingerprint serializes with recursively sorted keys, so it cannot
  depend on the ORDER a writer happened to emit keys in. Two writers commonly
  emit the same content differently — a personal-date event is `{...event, id}`
  from the editors but `{id, kind, anchor, …}` from their load-time sanitizer —
  and with a byte-sensitive fingerprint one mount flipped an unchanged
  section's bytes: at an equal stamp the store's copy won the tie-break, and
  the startup reconcile adopted-and-reloaded the Mini App on every single
  open. The **prefs fingerprint also drops the location's
  `label`/`labelLocale`** — they're derived by per-device, per-language reverse
  geocoding (the same place reads "Petah Tikva" / "Петах-Тиква" / "פתח תקווה"),
  so keeping them would make two devices in one place sync forever.
  Coordinates, elevation, timezone and any user `customLabel` still count.
- **A push never destroys irreplaceable content.** Stamps order whole
  *sections*, so a device whose prefs are merely newer wins the section
  outright — carrying away personal dates or saved locations another device
  added that this one never saw (add a yahrzeit on the phone, change the candle
  offset on the laptop, sync). A preference lost to last-write-wins can be set
  again; a date someone typed cannot. So if the merged blob would drop user
  items a store holds (`removedUserItems`, compared by item id — a rename is an
  edit, not a removal), that store is **not pushed to**: the run reports a
  conflict with `reason: 'removes-data'` and the same dialog asks. The
  exemption is a *dirty* prefs section, i.e. the user just answered this
  question ("keep this device" marks it), so the answer isn't asked twice.
  A deliberate deletion therefore prompts once, on the device it was made:
  without tracking which items this device ever synced, a delete and a
  never-seen addition are indistinguishable from the blob alone.
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

**One account at a time**, enforced in three places, because two connected
stores mirror every setting into two unrelated accounts and make the device
holding both a bridge that copies data between a Telegram-only device and a
Google-only one:

1. The panel withholds each provider's sign-in control while the other is
   connected (a line naming what to disconnect takes its place), so switching
   accounts is disconnect-then-sign-in.
2. `exchangeGoogleCredential` refuses a Google sign-in outright while a Telegram
   auth is stored — the credential never comes into existence, and the ID token
   is never sent to the bot.
3. **`activeSyncTargets` is where it actually holds**: it returns at most one
   account's stores. A connected Telegram account sidelines a signed-in Google
   one (Telegram wins — it is the authoritative store for its users, carrying
   the structured location / candle offset / havdalah opinion too, and it is the
   only account inside the Mini App). This covers devices that paired both
   before the gate existed; the Google credential is *kept* (dropping it would
   end a connection the user never asked to end) but dormant, and the panel
   shows it as connected-but-inactive. Its lineage is cleared while dormant, so
   if it ever becomes active again it reconciles as a fresh connect instead of
   blind-pushing over settings another device may have written meanwhile.

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
structured fields the bot itself models: location, cl_offset, havdala_opinion.
The offset and the opinion keep their two-way sync and chat confirmations; the
**location is never written by the app** — it only seeds a device that has none.
See [`telegram-mini-app.md`](telegram-mini-app.md)).

## Engine

`src/lib/sync/engine.ts`, mounted app-wide by
`src/components/providers/settings-sync.tsx`:

- **On load**: pull every connected store; if the newest remote beats the
  local stamp *and differs in content*, apply it and reload once (a
  sessionStorage guard makes reload loops impossible). Otherwise push the
  local blob to any store that's absent or stale. A store failing the lineage
  check is quarantined instead (see the connect rule above); when both sides
  hold clashing data the run reports a conflict, announced app-wide
  (`SYNC_CONFLICT_EVENT`) and resolved by the provider's choice dialog.
- **On change**: any synced setting changing stamps its section and runs the
  same reconcile with adoption switched off, debounced (the providers' own
  persist effects run first, so the pushed blob is never stale). It pulls first
  on purpose — a blind write of the local blob would destroy whatever another
  device had added since this one last synced, because a section is won whole.
  Newer remote sections still aren't written to localStorage here (the mounted
  providers would keep showing the old values); the next load adopts them.
- **Import** (link `#settings=…` or file): asks first, then applies with a
  fresh stamp so the import wins everywhere on the next sync.
- **After an app update**: a release that adds a preference key or changes a
  mount-written default moves the local prefs with nobody having edited
  anything, and at the *same* stamp — the equal-stamp tie-break decides by
  fingerprint order, which a grown section loses by construction (`}`/`]` sort
  above `,`/`"`), so the store's pre-update copy used to win and be adopted:
  one reload on the first open after every such release. The store hadn't
  moved, though — it still held exactly what this device last agreed on
  (`lastSyncedPrefs`) — so the local copy is the mover and is re-stamped above
  the tie and pushed instead, which is what the change watcher would do
  2.5&nbsp;s later anyway. A store that really did move (different stamp, or
  content that no longer matches the agreement) is still adopted.
- **Debugging a reload**: every adopt leaves a breadcrumb in
  `zmanim:sync-last-adopt:v1` (`{at, adopt}`) — readable from a webview console
  after the fact, no flag to pre-arm. Adopting everything on every open points
  at storage that didn't persist; one recurring section points at whatever
  rewrites it at mount. Live tracing:
  `localStorage.setItem('zmanim:sync-debug','1')` prints reconcile decisions
  with a `[zmanim-sync]` tag.

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
