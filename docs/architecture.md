# Architecture

How the app is put together and why. For the halachic domain specifics see [zmanim.md](zmanim.md); for ops see [deployment.md](deployment.md).

## Layering

The codebase is split into a **pure domain layer** and a **UI layer**, with a thin state/provider seam between them.

```
src/lib/  (pure, framework-free, unit-tested)
  zmanim/     time computation + display grouping
  calendar/   month grid, day classification, day events, navigation
  geo/        geocoding + timezone
  location.ts site.ts cities.ts format.ts

src/components/providers/  client state (app-state, accessibility, theme, query)
src/hooks/                 use-zmanim, use-geolocation

src/components/  (presentational; read state via hooks/providers)
src/app/         routes + metadata
```

Everything under `src/lib/` is deterministic and has no React/Next imports, so it can be unit-tested in isolation and reused on both server (SEO city pages) and client. UI components stay thin and read derived data from hooks.

## State

Two client providers hold app state (no global store, no server state for the core flow):

- **`app-state.tsx`** — `selectedDay`, `location` (lat/lng/tz/label/`inIsrael`), `monthDate`, `mode` (gregorian/hebrew), `candleLightingOffset`. Persists the selected day in the URL (`?d=…&m=…`) for shareable deep-links and restores from it on mount.
- **`accessibility-provider.tsx`** — `fontScale` (default/lg/xl/xxl), `reduceMotion`, `highContrast`. Read from `localStorage` in the `useState` initializer (matches a no-flash inline script in the layout that applies the html classes before paint), then applies html classes + persists in an effect.

`query-provider.tsx` holds a stable `QueryClient` for the geocoding search; `theme-provider.tsx` is `next-themes`.

### Hydration strategy

The calendar depends on "today" and the selected day, which differ between server and client. To avoid hydration mismatches, `src/components/app.tsx` gates the real UI behind a client-only mount check (`useIsClient` via `useSyncExternalStore`) and renders a skeleton during SSR. Because the calendar tree only mounts on the client, components inside it (e.g. `CalendarGrid` reading the accessibility font scale) can safely use client-only values.

## Rendering & routes

- `src/app/[locale]/layout.tsx` — fonts, `<html dir>` per locale, theme + accessibility + next-intl providers, `viewport`/`metadata`. `generateStaticParams` pre-renders the three locales.
- `src/app/[locale]/page.tsx` — home; supports deep-linked location.
- `src/app/[locale]/zmanim/page.tsx` — city index; `src/app/[locale]/zmanim/[city]/page.tsx` — per-city SEO page (ISR), server-rendered using the same `src/lib/` domain code.
- `src/app/{sitemap,robots,manifest}.ts` — generated metadata routes (server, build-time).
- `src/proxy.ts` — next-intl locale middleware (Next 16's renamed `middleware.ts`).

Because of ISR, locale routing, and dynamic deep-links, the app is **not** a static export — it runs as a standalone Node server in the container.

## The zmanim display pipeline

```
app-state (day, location, offset)
  → use-zmanim → computeZmanim()        // src/lib/zmanim/calculator.ts
  → buildZmanimGroups()                 // src/lib/zmanim/groups.ts (day-part → base → shitot)
  → ZmanimPanel / ZmanimList
```

The panel header also shows significant-day **chips** (`buildDayChips`) and a **times strip** (candle lighting / havdalah / fasts) computed for the whole rest-period the day belongs to (so both bookends show on Friday and Saturday). `NextZman` is a live countdown shown only for today.

See [zmanim.md](zmanim.md) for `definitions.ts` (the locked `key → method` map), the timezone-correct calculator, and grouping.

## The calendar

`CalendarGrid` builds a dynamic month grid (`src/lib/calendar/grid.ts`, 4–6 week rows) and computes, per cell, `getDayInfo` (category, holiday label, parsha, omer, rosh chodesh…) and `getDayEvents` (candle/havdalah/fast times). `CalendarDay` renders a cell.

### Responsive / fixed-viewport layout

The defining UI constraint: **the month must always fit the screen without scrolling.**

- The shell is `h-dvh` with `overflow-hidden` on desktop; the grid rows are `repeat(weeks, minmax(0,1fr))` so they divide the available height. The zmanim panel scrolls internally.
- **Mobile**: cells are compact — a day number, a single significant-day **dot**, and the alternate-calendar date. Full per-day detail lives in the panel (tap a day). The page scrolls (calendar then panel).
- **Largest accessibility text size (`xxl`)**: a full month can't fit at 1.4× text, so desktop cells also fall back to the compact view via `CalendarGrid`'s `compact` flag (derived from the accessibility font scale). `lg`/`xl` keep the fixed viewport.

### Color system

`src/components/calendar/day-style.ts` is the single source of truth for significant-day colors. `significantTone(category, dayOfChanukah)` maps a day to a `DayTone`, and `DAY_TONE[tone]` provides matching `chip` (panel) and `dot` (grid) classes — so the grid dot and the panel chip for the same day can never drift apart.

## Accessibility

- **Text scaling** uses a CSS variable: `html { font-size: calc(100% * var(--ui-scale) * var(--ui-screen)) }`. The `.text-scale-{lg,xl,xxl}` classes set `--ui-scale`; a small `--ui-screen` bump applies on very wide screens. **Consequence:** only **rem-based** sizes scale — never size text in fixed `px` if it should grow.
- `reduce-motion` kills animations; `high-contrast` overrides muted/border tokens.
- Touch-reachable disclosure: `ShitaInfo` uses a tap/click `Popover`, not a hover `title`.

## i18n

`next-intl` with locale-prefixed routing (`as-needed`: `/`, `/he`, `/ru`). `src/i18n/request.ts` loads `messages/{locale}.json` per request; the client provider inherits them (no `messages` prop). Display terminology is unified with the companion `zmanim_bot`. HE/EN holiday & parsha names come from the `kosher-zmanim` formatter; only Russian holiday names are overridden (`src/lib/calendar/holidays-ru.ts`).

## Geo (keyless, no tokens)

`src/lib/geo/geocoding.ts` — forward city search via **Open-Meteo**, reverse (coords → name) via **BigDataCloud**'s free client endpoint. `src/lib/geo/timezone.ts` — timezone resolved **offline** with `tz-lookup`. There are no API keys anywhere; the legacy Mapbox dependency was intentionally dropped.
