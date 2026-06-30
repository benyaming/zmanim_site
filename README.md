# Zmanim

Accurate halachic **zmanim** (Jewish prayer times) and calendar for any location, with Hebrew and civil dates, in English, Hebrew (RTL) and Russian.

Times are computed in-app with [`kosher-zmanim`](https://github.com/BehindTheMath/KosherZmanim) and cross-validated to the second against [Hebcal](https://www.hebcal.com/).

## Stack

- **Next.js 16** (App Router, React 19, React Compiler) + TypeScript
- **Tailwind CSS v4** + **shadcn/ui** (Radix), RTL-aware, dark mode via `next-themes`
- **next-intl** for i18n + locale routing (`/`, `/he`, `/ru`)
- **kosher-zmanim** + **Luxon** for the domain; **tz-lookup** for timezones
- **TanStack Query** for geocoding (keyless: Open-Meteo search + BigDataCloud reverse)
- **Vitest** + Testing Library for unit/golden/invariant tests

## Development

```bash
npm install
npm run dev          # http://localhost:3000
```

Copy `.env.example` to `.env` and set `NEXT_PUBLIC_SITE_URL` for correct SEO URLs.

### Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` / `npm run test:watch` | Vitest |
| `npm run test:e2e` | Playwright (when present) |

## Testing the zmanim engine

Zmanim correctness is treated as a first-class concern (`src/lib/zmanim`, `src/lib/calendar`):

- **Golden values** cross-validated to the second against Hebcal (Jerusalem, Brooklyn, London, Buenos Aires, LA)
- **Invariants** — 1000+ chronological-ordering checks across a lat/lng/date grid
- **Edge cases** — polar day/night, DST transitions, elevation, candle-lighting offset
- **Locked label↔calculation mapping** so a zman can never be shown under the wrong name

## Deployment (Docker, self-hosted)

The app runs as a standalone Node server in a container (it needs a runtime for ISR,
i18n routing and dynamic deep-links — it is **not** a static site).

```bash
# Build & run locally
docker compose up --build          # serves on 127.0.0.1:3000
```

On the server, CI pushes an image to GHCR; deploy with:

```bash
docker compose pull
docker compose up -d
```

Put your host nginx in front as a reverse proxy — see [`deploy/nginx.conf`](deploy/nginx.conf).
**Remove any old `location /zmanim { proxy_pass ... }` rule** — the app now owns `/zmanim/*`.

### CI/CD

`.github/workflows/ci.yml`:

- **Every push/PR:** lint, typecheck, test, build
- **Push to `main`:** build the Docker image, push to GHCR, then SSH to the server and `docker compose pull && up -d`

Required repository **secrets**: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `DEPLOY_DIR`.
Required repository **variable**: `NEXT_PUBLIC_SITE_URL`.
The server must have Docker + a `docker-compose.yml` referencing the GHCR image, and be able to pull it.

## Project structure

```
src/
  app/[locale]/        # routes (home, /zmanim, /zmanim/[city]) + layout
  app/{sitemap,robots,manifest}.ts
  components/          # app shell, calendar, zmanim, layout, providers, ui (shadcn)
  hooks/               # use-zmanim, use-geolocation
  i18n/                # next-intl routing, request, navigation
  lib/
    zmanim/            # definitions (locked mapping), calculator, types
    calendar/          # month grid, navigation, day-info
    geo/               # timezone, geocoding
    cities.ts          # curated cities for SEO pages
messages/              # en / he / ru catalogs
```

## License

MIT
