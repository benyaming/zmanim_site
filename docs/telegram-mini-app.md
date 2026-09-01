# Telegram Mini App

The site doubles as a [Telegram Mini App](https://core.telegram.org/bots/webapps)
inside the companion [`zmanim_bot`](https://t.me/zmanim_bot) (sibling repo
`zmanim_bot/`). The integration is layered so each piece works without the
next one:

| Layer | What it gives | Requires |
| --- | --- | --- |
| Static launch | The app opens inside Telegram | BotFather config only |
| Personalized launch | Opens on the user's bot location + language | `MINIAPP_URL` on the bot |
| Webview setup | Full height, no swipe-to-minimize, no PWA-install UI | nothing (automatic) |
| Profile sync | Bot settings applied on open, in-app changes pushed back | `MINIAPP_URL` (bot) + `NEXT_PUBLIC_TG_BOT_API_URL` (site) |

## How it fits together

```
Telegram client
  └─ opens MINIAPP_URL (menu button / "📅 Open calendar" keyboard button)
       URL = site origin + /he|/ru + ?lat=&lng=&label=&elevation=   ← instant first paint
       fragment = #tgWebAppData=…&tgWebAppPlatform=…                ← detection + auth
  └─ site (this repo)
       src/lib/telegram/mini-app.ts    detection, SDK load, expand/ready/no-swipes
       src/components/providers/telegram-mini-app.tsx   profile fetch + write-back
       src/lib/telegram/bot-sync.ts    HTTP client for the bot API
  └─ bot API (zmanim_bot repo, aiohttp)
       POST {WEBHOOK_PATH}/miniapp/me     → {language, cl_offset, havdala_opinion, location, locations, web_prefs}
       POST {WEBHOOK_PATH}/miniapp/sync   → applies location / cl_offset / havdala_opinion / web_prefs
       POST {WEBHOOK_PATH}/miniapp/export → relays an export file to the user's chat
       auth: the signed initData string (or, from the plain site, a Login Widget
       payload as auth_data), validated against the bot token per request
```

`web_prefs` is the site's full settings snapshot (the sync blob — see
[settings-sync.md](settings-sync.md)), stored verbatim in Mongo so **every**
configurable thing follows the user across devices, not only the three
fields the bot models. Blob syncs are silent; the chat confirmation below
covers only the structured fields.

Detection is fragment-based (`tgWebAppPlatform` in the launch hash), captured
at module load before the calendar's URL-reflect effect rewrites the URL, and
remembered in `sessionStorage` for in-webview reloads. Outside Telegram every
piece is a no-op and the SDK script is never loaded.

**Sync semantics** (see `TelegramMiniApp`): on open, the bot profile's candle
offset and havdalah opinion override the locally persisted ones — but never a
change the user just made in the app (`applyBotProfile` skips values touched
this session). After a successful `/me`, drift between those two values and the
bot baseline is pushed back debounced; the baseline only advances on confirmed
syncs, so failed pushes retry on the next change.

**The location is the exception, in both directions.** The bot's location only
**seeds** a device that has no location of its own (`applyBotProfile` checks
`locationLocked`: a URL deep link, a restored non-default pref, a precise fix,
or a pick made here all count as having one), and it is **never written back**.
The launch URL's `?lat=&lng=` deep link follows the same rule in miniature: it
decides what the app *opens on* (the bot's location, instant first paint) but
is **session-only** — never persisted to prefs, so it can't overwrite the
app's own synced location or diverge the device from the settings blob.
Persisting it used to do exactly that, which made the startup sync reconcile
adopt the blob and reload the Mini App once on every open (see
[`settings-sync.md`](settings-sync.md)). A location picked in-app persists (and
syncs) as usual; the next personalized launch still opens on the bot's.
The two are not the same act: the bot's location decides where its daily
messages come from, while the app's is whatever times the user is looking at
right now — so browsing another city must not move the bot, and a location
chosen in the app must not be undone at the next launch. The app's own location
travels between devices in the settings blob like every other setting. This
also removed a reload loop: re-applying the bot's location on every mount
rewrote prefs each time, which the settings reconcile then kept adopting (see
[`settings-sync.md`](settings-sync.md)). Every applied sync is confirmed with a silent bot message ("Changed
from the calendar app: …", localized), so bot-side state never changes
invisibly. The shared havdalah opinion keys and the candle-offset semantics are
identical in both projects by design (`src/lib/zmanim/havdalah.ts`).

**Two builds were the last driver of the restart-on-open.** Devices write
their build's defaults into prefs at mount, and `seenOptInZmanim` is literally
the running build's opt-in list — so a Mini App webview holding a cached bundle
and a browser on a newer one disagreed about prefs while agreeing about
everything the user chose. Each adopted the other's copy and reloaded, then
rewrote and pushed its own, so the next open on the other side did the same:
a restart on every open, no release needed. Derived values are now outside the
content fingerprint (see [`settings-sync.md`](settings-sync.md) → *Derived
values never count as content*).

**An app update was another driver of the restart-on-open.** A release that
adds a preference or changes a mount-written default moves the local prefs
without anyone editing anything, and the equal-stamp tie-break handed the
section to the store's pre-update copy — an adopt, i.e. a reload, on the first
open after such a release. It showed up here and not on the website because the
Mini App's pull waits for the Telegram SDK to load first, so the migrated prefs
are always in place by the time the reconcile snapshots them. It also swallowed
the "What's new" popup — the popup stamps itself seen on render, so a changelog
eaten by a restart never comes back. Fixed in `reconcileTargets` (see
[`settings-sync.md`](settings-sync.md) → *After an app update*).

**The language works like the deep-link location.** The bot launches the app at
its own language path (`/he`|`/ru`) on every open, so inside the Mini App the
page locale is the bot's, not the user's. The sync engine is therefore
**passive about language** there (see `reconcileTargets`): the URL-derived
locale contributes nothing to the merge — the blob's language rides through
intact instead of being clobbered by the launch path — and a remote language is
never adopted, because adopting navigates, i.e. visibly restarts the webview on
every open (the next launch would reset the locale right back). The session
simply runs at the launch locale, mirroring the bot; an explicit in-session
language pick still syncs out like any deliberate edit.

GPS auto-detection is skipped inside the webview (unreliable there, and the
bot profile is better); the soft IP guess and the manual GPS button still work.
Lehumra minute rounding defaults ON inside Telegram (the bot always rounds
lehumra, and the mini app mirrors its times) unless the user has explicitly
toggled it (`lehumraCustomized`).

**Exports** (CSV/XLSX/PDF): the webview can't do browser downloads, so inside
Telegram `downloadBlob` posts the file to `/export` (multipart, preflight-free)
and the bot sends it to the user's chat as a document; a toast confirms it. On
failure the toast says so and a regular download is still attempted (Telegram
Web can download). The bot's saved locations (`locations` in the profile) are
listed in the location picker as select-only rows — adding a new place syncs
while the bot's list is under `LOCATION_NUMBER_LIMIT`; at the limit the change
stays local (the bot's curated list is never overwritten from the app).

## Configuration

Site (build-time, public, optional):

- `NEXT_PUBLIC_TG_BOT_API_URL` — the bot's mini-app API base, e.g.
  `https://<bot-host>/zmanim_bot/miniapp`. Unset = profile sync off; everything
  else still works.

Bot (`zmanim_bot/.env`):

- `MINIAPP_URL` — this site's origin, e.g. `https://zmanim.example`. Unset =
  no keyboard/menu buttons and the API stays dark. In dev, point it at
  `http://localhost:3000`; polling mode then serves the API on
  `MINIAPP_DEV_API_PORT` (default 8080, so
  `NEXT_PUBLIC_TG_BOT_API_URL=http://localhost:8080/zmanim_bot/miniapp`).
  CORS is restricted to the `MINIAPP_URL` origin in prod and open in dev.
  Telegram rejects plain-http `web_app` URLs, so with an `http://` value the
  bot serves the API but skips the buttons — use an https tunnel URL to test
  the launch buttons in a real client.

## One-time BotFather setup

The bot sets a personalized menu button per chat automatically, but two
BotFather steps are still worth doing:

1. `/mybots` → the bot → *Bot Settings* → *Menu Button* → set the site URL —
   the default for chats the bot hasn't personalized yet.
2. `/newapp` → attach a Mini App to the bot (name, description, photo) — this
   enables the shareable `https://t.me/<bot>/<appname>` direct link. Direct
   links launch with no query params; the profile sync covers personalization
   there.

## Testing locally

1. Site: `npm run dev` (port 3000). Bot: set `MINIAPP_URL=http://localhost:3000`
   in `.env` and run polling as usual.
2. Telegram only opens HTTPS mini apps, so tunnel the site (e.g.
   `ssh -R`/cloudflared/ngrok) and use the tunnel URL as `MINIAPP_URL` when
   testing inside a real client. For quick iterations, Telegram Desktop with
   *Settings → Advanced → Experimental → Enable webview inspecting* gives
   devtools inside the webview.
3. The plain-browser behavior must stay untouched — the unit tests in
   `src/lib/telegram/` pin detection, and the rest of the suite runs with no
   Telegram environment at all.
