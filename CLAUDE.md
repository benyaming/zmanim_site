# CLAUDE.md

Guidance for AI agents and contributors working in this repo. Read this before making changes. Deeper references live in [`docs/`](docs/).

## What this is

Zmanim — halachic Jewish prayer times + calendar for any location, trilingual (English / Hebrew RTL / Russian). Times are computed **in-app** with [`kosher-zmanim`](https://github.com/BehindTheMath/KosherZmanim) and cross-validated to the second against Hebcal.

**Zmanim correctness is the product.** Treat the domain layer (`src/lib/zmanim`, `src/lib/calendar`) as safety-critical: never change a calculation, a `key → method` mapping, or a description without a test that pins the expected behavior. When in doubt about a halachic meaning, verify against an authoritative source (KosherJava javadocs, myzmanim) — don't guess.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) on `0.0.0.0:3000` |
| `npm run lint` | ESLint (flat config, `next/core-web-vitals` + TS) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (unit / golden / invariant / edge) |
| `npm run test:e2e` | Playwright |
| `npm run build` | Production build (standalone output) |

Run **lint + typecheck + test** after any change; they are the CI gate.

## Stack & version gotchas

- **Next.js 16** App Router, React 19, **React Compiler is on**:
  - Do **not** write manual `useMemo`/`useCallback` — the compiler memoizes, and `react-hooks/preserve-manual-memoization` will flag it.
  - Do **not** `setState` inside an effect (`react-hooks/set-state-in-effect`). For a client-only mount gate use `useSyncExternalStore` (see `src/components/app.tsx`), not `useEffect` + state.
  - The middleware file is **`src/proxy.ts`**, not `middleware.ts` — Next 16 renamed it. Older tooling/linters (and GitHub Copilot review) will wrongly claim it "won't run." It does.
- **next-intl v4**: `NextIntlClientProvider` inherits `messages`/`locale` from the request config (`src/i18n/request.ts`) — it deliberately does **not** take a `messages` prop. Catalogs are `messages/{en,he,ru}.json`. Server components call `setRequestLocale(locale)` before reading translations.
- **Tailwind v4**: CSS-based config in `src/app/globals.css` (`@theme`, oklch tokens). Merge classes with `cn()` from `@/lib/utils`.
- **shadcn/ui** components live in `src/components/ui/` (RTL enabled, generated via `components.json`). Prefer composing these over new primitives.
- **No `React.ReactNode`** without importing `ReactNode` — import the type explicitly (avoids relying on the React UMD global).

## Architecture map

```
src/
  app/[locale]/            routes: home, /zmanim (city index), /zmanim/[city] (ISR SEO)
  app/{sitemap,robots,manifest}.ts
  components/
    app.tsx                client shell: layout, providers, mount gate
    calendar/              calendar-grid, calendar-day, calendar-view, day-style
    zmanim/                zmanim-panel, zmanim-list, next-zman, shita-info
    layout/ providers/ ui/
  hooks/                   use-zmanim, use-geolocation
  i18n/                    routing, request, navigation (next-intl)
  lib/
    zmanim/                definitions (locked mapping), calculator, groups, types
    calendar/              grid, navigation, day-info, day-events, holidays-ru
    learning/              daily-learning cycles (@hebcal/learning Base modules), he/ru names
    geo/                   geocoding (keyless), timezone (offline), localities (bundled index)
    sync/                  cross-device settings sync: blob, engine, stores (docs/settings-sync.md)
    location.ts site.ts cities.ts format.ts utils.ts
  proxy.ts                 next-intl middleware (Next 16's renamed middleware.ts)
messages/                  en / he / ru catalogs
```

Data flow: `app-state` (selected day, location, candle offset) → `use-zmanim` → `computeZmanim()` → `buildZmanimGroups()` → panel; the calendar grid computes per-cell `getDayInfo` + `getDayEvents`. The calendar renders **client-only after mount** so "today"/selection can't cause a hydration mismatch.

See [`docs/architecture.md`](docs/architecture.md) for the full narrative.

## Critical correctness rules (do not break)

1. **Timezone day handling** — build a calendar day's noon from date *components* in the target zone: `DateTime.fromObject({year,month,day,hour:12},{zone:tz})`. Never `setZone()` an instant to derive the day (it shifts across tz/DST). Convert each computed time with `.setZone(tz)`. A golden test catches regressions.
2. **Work-prohibited day** — use `isYomTovAssurBemelacha()`, **not** the broad `isYomTov()` (true for Purim/Chanukah). Chanukah classifies as `weekday` in `classify()`.
3. **Israel vs diaspora** — `location.inIsrael` is threaded through `getDayInfo`/`getDayEvents`; it changes the parsha schedule and 1- vs 2-day Yom Tov. It is always derived from the timezone and recomputed on load. tz-lookup's coarse polygons put the whole West Bank — including Gilo, Ma'ale Adumim, Ariel — in `Asia/Hebron` (and Gaza in `Asia/Gaza`); `tzFromLatLng` normalizes both to `Asia/Jerusalem`, and `isIsraelTimezone` still accepts all three for legacy persisted locations. Don't reduce the check back to `=== 'Asia/Jerusalem'`.
4. **Week parsha** — `kosher-zmanim`'s `getUpcomingParsha()` is broken in 0.9 (throws). Compute it by walking to the coming Saturday.
5. **`candleLighting` is returned every day** by `computeZmanim` (sunset − offset). It is only a real zman on Erev Shabbat / Erev Yom Tov — filter it out elsewhere (e.g. the "next zman" banner gates it on `isErev`).
6. **Daily learning** (`src/lib/learning`) — cycles come from `@hebcal/learning` **Base subpath imports only** (`dafYomiBase`, `mishnaYomiBase`, …) so the GPL'd `@hebcal/core` never enters the bundle. Do **not** use `kosher-zmanim`'s `YerushalmiYomiCalculator` for display: in 0.9 it is off by one on tractate-transition days (returns e.g. "Shabbat 93" when Vilna Shabbat has 92 dapim); Hebcal + Sefaria agree on the correct page and a cross-validation test pins the relationship. Every tractate/book/section name must have he + ru entries (`names.ts` / `names-ru.ts`) — a completeness test enumerates all reachable names.
7. **Descriptions** — verified against KosherJava/myzmanim. The "≈ X min before sunrise" figures on degree-based zmanim are the **Jerusalem-equinox anchor** and vary by location/season; keep that qualifier. Details in [`docs/zmanim.md`](docs/zmanim.md).

## UI / responsive conventions

- **Fixed-viewport calendar**: the month always fits the screen (no page scroll). The shell is `h-dvh` (desktop) and the grid rows are `repeat(weeks, minmax(0,1fr))`; the zmanim panel scrolls internally.
- **Largest text size (`xxl`)** can't fit a full month — cells fall back to a compact view (big number + significant-day dot + alternate-calendar date) via `CalendarGrid`'s `compact` flag (driven by `accessibility-provider`'s font scale). `lg`/`xl` keep the fixed viewport. Mobile always uses the compact cells; full detail is in the day panel.
- **Accessibility text scaling** uses `--ui-scale` on `html { font-size }`. Any text that should grow must use **rem-based** sizes — a fixed `text-[11px]` will not scale. Prefer rem arbitrary values (`text-[0.6875rem]`).
- **Day colors**: `src/components/calendar/day-style.ts` `DAY_TONE` + `significantTone()` are the single source for significant-day colors — used by both the grid dot and the panel chip, so they always match. Edit there.
- **Touch-friendly disclosure**: use a tap/click `Popover` (see `ShitaInfo`), never a hover-only `title`, for content users need on mobile.

## i18n / translations

- Terminology is unified with the companion `zmanim_bot` project: transliterated zman names; readable opinion labels ("Vilna Gaon" / "Magen Avraham").
- **HE/EN** holiday & parsha names come from the `kosher-zmanim` formatter. Only **Russian** holiday names are overridden, in `src/lib/calendar/holidays-ru.ts`.
- A zman's visible whole-zman caption is `zmanim.baseDescriptions`; the per-opinion detail is `zmanim.descriptions` (shown behind the info popover).

## Deployment

Image-only CI (`.github/workflows/ci.yml`): lint/typecheck/test/build + Playwright gate, then **build & push** `ghcr.io/<repo>:latest` and `:sha-<commit>` on push to `main`. There is **no auto-deploy** — pull + `docker compose up -d` on the server manually. The app has **no runtime secrets** (all client-side). Full guide: [`docs/deployment.md`](docs/deployment.md).

- The committed **`package-lock.json` must be cross-platform** because CI uses strict `npm ci`. If you change dependencies, regenerate the lockfile on Linux or CI will fail with `EUSAGE` (missing Linux/WASM optional deps):
  ```bash
  docker run --rm -v "$PWD":/w -w /w node:22-slim npm install --package-lock-only --no-audit --no-fund
  ```

## Conventions

- **Conventional Commits** enforced by commitlint (husky `commit-msg`); `pre-commit` runs `eslint --fix` via lint-staged.
- **Version & release notes** — `src/lib/releases.ts` is the source of truth for the visible app version (not package.json); the footer's corner shows it as a `v…` button that opens the release-notes pane, and a one-time "What's new" popup shows unseen releases after an update. **Bump the version for user-facing changes worth announcing** (+0.1; major bumps only when the maintainer calls a milestone) by prepending a `RELEASES` entry — same date-cut PR = one entry — in **all three locales** (en/he/ru). Notes are **one to three one-line bullets naming the headline features only** (aim ≤ ~100 chars each): fold minor tweaks into a single catch-all line or drop them entirely, and declare *what* shipped without explaining *how to use it* — no walkthroughs, option lists, or default-value caveats. **Minor fixes, small UI tweaks, and internal-only refactors don't require a bump** — skip the release entry entirely, or fold them into a catch-all line if a release is being cut anyway.
- **No AI/agent attribution anywhere** — commits, PR titles/bodies, code comments, authors. This is the maintainer's standing rule; keep all output clean of it.
