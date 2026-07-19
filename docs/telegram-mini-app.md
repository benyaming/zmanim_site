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
       POST {WEBHOOK_PATH}/miniapp/me     → {language, cl_offset, havdala_opinion, location, locations}
       POST {WEBHOOK_PATH}/miniapp/sync   → applies location / cl_offset / havdala_opinion
       POST {WEBHOOK_PATH}/miniapp/export → relays an export file to the user's chat
       auth: the signed initData string, validated against the bot token per request
```

Detection is fragment-based (`tgWebAppPlatform` in the launch hash), captured
at module load before the calendar's URL-reflect effect rewrites the URL, and
remembered in `sessionStorage` for in-webview reloads. Outside Telegram every
piece is a no-op and the SDK script is never loaded.

**Sync semantics** (see `TelegramMiniApp`): inside Telegram the bot profile is
the source of truth — on open it overrides the locally persisted location,
candle offset, and havdalah opinion, but never a change the user just made in
the app (`applyBotProfile` skips values touched this session). After a
successful `/me`, drift between the app state and the bot baseline is pushed
back debounced; the baseline only advances on confirmed syncs, so failed
pushes retry on the next change. The un-chosen default location is never
pushed. Every applied sync is confirmed with a silent bot message ("Changed
from the calendar app: …", localized), so bot-side state never changes
invisibly. The shared havdalah opinion keys and the candle-offset semantics are
identical in both projects by design (`src/lib/zmanim/havdalah.ts`).

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
