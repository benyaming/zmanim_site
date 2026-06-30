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

`NEXT_PUBLIC_SITE_URL` defaults to `http://localhost:3000`; set it (env or repo variable) for correct SEO URLs in production.

> Working on the code? Start with [`CLAUDE.md`](CLAUDE.md), then [`docs/`](docs/) — [architecture](docs/architecture.md), [zmanim domain](docs/zmanim.md), [deployment](docs/deployment.md).

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

CI builds and pushes an image to GHCR (it does **not** auto-deploy). On the server:

```bash
docker compose pull
docker compose up -d
```

Put your host nginx in front as a reverse proxy — see [`deploy/nginx.conf`](deploy/nginx.conf).
**Remove any old `location /zmanim { proxy_pass ... }` rule** — the app now owns `/zmanim/*`.

### CI/CD

`.github/workflows/ci.yml`:

- **Every push/PR to `main`:** lint, typecheck, test, build + Playwright e2e
- **Push to `main`:** build the Docker image and push to GHCR (`:latest` + `:sha-<commit>`)

Required repository **variable**: `NEXT_PUBLIC_SITE_URL`. No secrets are needed (no auto-deploy, no runtime tokens). See [`docs/deployment.md`](docs/deployment.md) for server setup, GHCR auth, and the cross-platform lockfile requirement.

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
