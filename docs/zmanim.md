# Zmanim domain

The halachic engine and calendar logic. This is the safety-critical part of the app — changes here need tests that pin expected behavior, and halachic meanings should be verified against authoritative sources, not memory.

Sources used for the descriptions and definitions:
- KosherJava javadocs (authoritative for the library this app uses) — <https://kosherjava.com/zmanim/docs/api/> (esp. `ComplexZmanimCalendar`, based on *Yisrael Vehazmanim*)
- myzmanim.com — degrees/explanations, accuracy, and sources — <https://www.myzmanim.com/read/degrees.aspx>, <https://www.myzmanim.com/read/accuracy.aspx>, <https://www.myzmanim.com/read/sources.aspx>
- Wikipedia, "Zmanim" — <https://en.wikipedia.org/wiki/Zmanim>
- Chabad.org "About Our Zmanim Calculations" — <https://www.chabad.org/library/article_cdo/aid/3209349>

## `definitions.ts` — the single source of truth

`src/lib/zmanim/definitions.ts` binds each displayed zman to an exact `kosher-zmanim` method. It carries a broad set of opinions per base — the everyday defaults **plus** many additional shitot (Baal HaTanya, Rabbeinu Tam degree/proportional forms, the fixed- and degree-minute Alot / Sof-zman / Mincha / Tzeit families). Everything beyond the defaults is **opt-in**: hidden until enabled in settings (`OPT_IN_ZMANIM` in `visibility.ts` + the `seenOptInZmanim` migration). Only list a *newly added* key in `OPT_IN_ZMANIM` — force-hiding a key a user could already have enabled would override their choice.

Each entry is `{ key, base, method, category, order, erevOnly?, erevPesachOnly?, duration? }`:

- `key` — stable id used to look up the name/shita/description in the message catalogs (`zmanim.names` / `zmanim.shitot` / `zmanim.descriptions`).
- `base` — groups opinions of the same zman (e.g. `alos`, `misheyakir`, `sofZmanShma`, `sofZmanTfila`, `tzais`).
- `method` — the `ComplexZmanimCalendar` method to call.
- `category` — day-part for sectioning (`dawn`/`morning`/`midday`/`afternoon`/`evening`).
- `order` — display order (strictly increasing).
- `erevOnly` — `candleLighting` only.
- `erevPesachOnly` — the chametz deadlines; surfaced only on 14 Nissan.
- `duration` — the shaah zmanis (astronomical hour) entries only: the method returns a **length in milliseconds** (surfaced as `durationMillis`; `time` stays null), rendered as an h:mm:ss duration rather than a clock time. MGA divides alos 72 → tzais 72; GRA sunrise → sunset — so MGA's hour is always exactly 12 minutes longer (pinned by an invariant test). Lehumra rounding never touches them. They are opt-in: hidden by default for everyone, including saves that predate them (`OPT_IN_ZMANIM` in `visibility.ts` + the `seenOptInZmanim` migration in `app-state`).

`definitions.test.ts` enforces the invariants: every `method` exists on the calendar prototype, keys are unique, `order` is strictly increasing, and the **exact `key → method` mapping is locked** — so a zman can never silently start being shown under the wrong name or computed by the wrong method. If you add/rename a zman, update the locked mapping test deliberately.

## `calculator.ts` — timezone-correct computation

`computeZmanim({ lat, lng, date, elevation = 0, useElevation = false, timeZoneId?, candleLightingOffset = 18, keys? })` returns `{ key, time, erevOnly }[]`.

**`keys` (performance):** each zman is a solar calculation, so computing all ~50 opinions costs ~4 ms/day — fine for the memoized single-day panel, but wasteful where only a few times are needed per day over many days. Pass `keys` (an iterable of zman keys) to compute just that subset. The calendar grid and the month/table exports render only **event** times (candle / havdalah / fast), so they pass `dayEventZmanKeys(havdalahZmanKey(opinion))` — the minimal set `getDayEvents` reads (`candleLighting`, `alosHashachar`, `sunset`, the fast-end tzeitim, and the havdalah key). That makes a month grid ~10× cheaper (≈155 ms → 16 ms for 42 cells). `day-events.parity.test.ts` pins that the subset yields byte-identical events to a full compute across every fast day and havdalah opinion, so the optimization can never silently drop a time.

**The critical detail:** the calendar day is established by constructing *noon in the target zone from date components*:

```ts
const localNoon = DateTime.fromObject(
  { year, month, day, hour: 12 },
  { zone: timeZoneId },
);
```

Do **not** `setZone()` an existing instant to get the day — that shifts the calendar day across timezone/DST boundaries and produces times for the wrong day. `kosher-zmanim` returns each result as a UTC `DateTime`, which is then converted with `.setZone(timeZoneId)` for display. A golden test (validated to the second against Hebcal across Jerusalem, Brooklyn, London, Buenos Aires, LA) guards this, alongside invariant sweeps (chronological ordering over a lat/lng/date grid) and edge cases (polar day/night, DST, elevation, offset).

`candleLighting` is computed for **every** day (sunset − offset). It is only meaningful on Erev Shabbat / Erev Yom Tov; callers must filter it (the panel's times strip and `NextZman` both gate it on "erev").

**Method family.** Every definition carries a `family` (`ZmanFamily` in `types.ts`) — the axis on which opinions of one zman genuinely disagree. A zman that is a *moment of twilight* (alot, misheyakir, tzeit) is one of `degrees` (a sun depression angle), `fixedMinutes` (a fixed clock-minute offset from sunrise/sunset or chatzot), or `seasonalMinutes` (a *zmaniyos* offset, where a minute is 1/60 of a shaah zmanis and so stretches with the day). A zman that is a *fraction of the halachic day* (sof zman Shma/Tfila, the chametz deadlines, mincha, plag, the shaah-zmanis durations) is one of `dawnToNightfall` or `sunriseToSunset` — because for those the disagreement is over when the day begins and ends, not the arithmetic. The `dawnToNightfall` day (Magen Avraham) runs alos→tzeis; `sunriseToSunset` (Vilna Gaon, and — from his own *netz amiti* — the Baal HaTanya) runs sunrise→sunset. The pure-solar times (sunrise, sunset, chatzot, solar midnight) are `solar`. The one exception to the moment/fraction split is mincha gedola 30, a fixed 30-minute offset from chatzot, hence `fixedMinutes`. `family` is **pure metadata — it never affects a computed time**; it exists so the UI can group, filter and explain opinions by method rather than by parsing a translated shita label. The key→family mapping is locked in `definitions.test.ts` alongside the key→method mapping.

`buildZmanimGroups` partitions each base's rows by family (`ZmanBaseGroup.families`) in a fixed canonical order — angles, fixed minutes, seasonal minutes, then the two day-definitions, then solar — with rows chronological *within* a family. The order is deliberately **not** by time: families are competing answers to one question, their relative order shifts with latitude and season (a fixed-90 dawn precedes the 19.8° one in Jerusalem and follows it in Düsseldorf), and sorting the headings would imply a chronology across methods that isn't being claimed. This is what keeps the flat chronological sort honest: within a family time order means something, across families it never did.

The panel shows family headings **only where the split earns them** — `ZmanBaseGroup.grouped`, true when at least *two* families each carry more than one opinion. Today that is Alot and Tzeit (angle / fixed / seasonal) and Sof zman Shma & Tfila (dawn-to-nightfall vs sunrise-to-sunset). The threshold matters: it is what makes Shma/Tfila group (their 30-minute Magen-Avraham-vs-Vilna-Gaon spread is otherwise invisible, since *every* opinion is a day-fraction and a coarser "one family" test would collapse them) while keeping Mincha Gedola flat (a lone fixed-30 and a lone MGA-16.1° alongside the sunrise-to-sunset pair — only one multi-opinion family, and its opinions sit within ~6 minutes). Everywhere else a heading would restate what the rows already say, so the list stays flat — and since the everyday default is one shita per zman, a default user sees no headings at all: the structure appears exactly when the reader opts into the complexity that needs it. Each heading carries an info popover explaining what that method measures (`zmanim.families` / `zmanim.familyDescriptions`).

**Short nights.** At high latitudes a degree-based dawn/nightfall can be undefined — the sun never reaches the depression angle — which the engine returns as `null`. That null is a real answer and is **reported, never filled in from another family**. A zman goes blank this way while the day is otherwise normal when its calculation depends on a sun angle: the `degrees` families directly, and also the day-fraction opinions bounded by a degree dawn/nightfall (the Magen Avraham `dawnToNightfall` variants — `sofZmanShmaMGA18/161`, `minchaGedola161`, …). Their `fixedMinutes`, `seasonalMinutes` and `sunriseToSunset` neighbours need only a real sunrise/sunset, so they still resolve. The day panel explains such a blank with `zmanim.noDegreeTimeNote`, **appended to the info popover** of the affected family heading (grouped base) or zman name (otherwise). It was originally visible inline prose, on the theory that a dash a user can't explain reads as broken data; with several opinions blank at once that repeated the same paragraph down the list and buried the times it was meant to clarify, so it moved behind the icon already sitting beside the heading. The note keys on *a blank moment on a non-polar day* (`isBlankMoment` in `zmanim-list.tsx`), not the `degrees` family label (which would miss the degree-bounded day-fractions). It is composed **once** per affected group — on the family heading in a grouped base, on the name in a flat multi-opinion base, and (crucially) on the single row of the everyday one-opinion default, which is where a default user actually meets the blank. A **true polar day/night** (no sunrise/sunset at all) blanks *everything*, so the caption wouldn't hold: `isPolarDay(zmanim)` detects it and the callers pass an empty note, leaving the bare dashes to stand.

This is deliberate, and it is a change from the 1.18 behaviour, which substituted a seasonal-hour approximation into the null degree row and flagged it `approximate`. That was wrong on two counts. It **mislabeled the shita**: at Düsseldorf on 2 July 2026 it printed 03:43 — the 72-*seasonal*-minute time, 99 real minutes before sunrise — under the 16.1° label, while myzmanim prints its "dawn degrees" blank there and publishes 4:10 AM under "dawn fixed minutes" (`alos72`, matching us to the minute). And it **quietly ruled on an open machloket**: what a short-night location should keep is genuinely unsettled among the poskim (fixed minutes, proportional minutes, the last date the phenomenon occurred, the nearest latitude where it still occurs, or treating the period as safek), and picking one silently, under another shita's name, is not the app's call. myzmanim's own design — parallel "degrees" and "fixed minutes" ladders, with the degrees column left blank — is precisely a refusal to rule; we follow it. The contract is pinned in `calculator.shortnight.test.ts`, including the Düsseldorf case above.

**Fast bookends.** Both ends of a fast fall through to a fixed-minute time on a short night, each labelled with the opinion that produced it, so a fast is never left without a shown start or end. The **start** reads the first opinion in `FAST_START_ZMAN_KEYS` (`day-events.ts`) that has a time — the 16.1° dawn at most latitudes, the fixed-72-minute dawn where 16.1° is out of reach — named in the event's `zmanKey` (the panel renders it as a badge). The **end** is chosen by the user from `FAST_END_OPINIONS`, but when *every* visible end opinion is null (all the defaults are degree-based), `getDayEvents` appends `FAST_END_FALLBACK` — Rabbeinu Tam's fixed 72-minute nightfall, a `nightfall`-kind opinion valid for every fast — so a real, labelled end always appears. The blank degree rows stay, so the user still sees which opinions had no time. The single-slot surfaces (calendar grid, month/table exports) pick the earliest fast-end that *has* a time (`fastEnds.find(e => e.time) ?? fastEnds[0]`) rather than the first regardless, and pass `DEFAULT_HIDDEN_FAST_END` so they share the panel's fallback. A true polar day (no sunset to anchor the fixed nightfall) still shows blanks — nothing can be invented there. Offering fast-start as a user-configurable opinion list, mirroring fast-end, remains the natural next step.

**Elevation is opt-in** (`useElevation`, off by default — a global user preference, since standard published times and the Hebcal cross-validation are sea-level). When enabled, sunrise/sunset and every zman measured from them (fixed-minute offsets, shaos-zmaniyos fractions) become elevation-adjusted, matching KosherJava's `setUseElevation` and Hebcal's `ue=on`; degree-based zmanim, chatzos and candle lighting intentionally stay sea-level. The calculator zeroes the elevation itself when the flag is off — kosher-zmanim's raw `getSunrise`/`getSunset` honor the `GeoLocation` elevation regardless of the flag, so passing it uninvited would shift only those rows and leave derived zmanim at sea level (an inconsistent panel). Negative elevations (Dead Sea basin) clamp to sea level; `GeoLocation.setElevation` throws on them. `AppLocation.elevation` comes from the Open-Meteo geocoder response, or is backfilled from the Open-Meteo elevation API (both keyless); a dedicated test file (`calculator.elevation.test.ts`) pins all of this against Hebcal-validated golden values.

## `groups.ts` — display grouping

`buildZmanimGroups(zmanim, translators)` produces a two-level structure:

1. by `category` (day-part) → `ZmanGroup`
2. within a group, by `base` → `ZmanBaseGroup` with `rows: ZmanRow[]` (one per shita/opinion)

Each base's visible caption is `baseDescriptions[base]` when there are multiple opinions, or the single row's `descriptions[key]` when there's one. The **per-opinion** detail (`descriptions[key]`) is shown behind the info popover, not inline (see `ShitaInfo`).

## Calendar classification (`day-info.ts`, `day-events.ts`)

- `getDayInfo(date, formatter?, locale, inIsrael)` → category, holiday label, `yomTovIndex`, `dayOfChanukah`, `isRoshChodesh`, `isShabbos`, `parsha`, `weekParsha`, `omer`, `isShabbosMevorchim`, Hebrew date.
- `classify()` precedence matters because `isYomTov()` is broad. **Chanukah is checked first and classified as `weekday`** (it's a minor festival; `isYomTov()` reports it as a Yom Tov). Order: chanukah → cholHamoed → erevYomTov → yomTov → taanis → roshChodesh → shabbos → weekday.
- `getDayEvents(date, times, inIsrael, hiddenFastEnd)` → candle lighting / havdalah / fast start / fast end. It uses **`isYomTovAssurBemelacha()`** (work-prohibited), NOT `isYomTov()`, to decide what's a "rest day." Tisha B'Av onset shows on its eve; Yom Kippur's end is havdalah (no duplicate nightfall).

#### Fast-end opinions (`fast-end.ts`)

A fast ends at tzeit; `FAST_END_OPINIONS` is the catalog, tagged by `kind` — a display grouping (in settings) that describes how stringent each tzeit is:

- **`gmarTaanis`** — three *medium* stars, per myzmanim's "gmar hataaniyos": the (earlier) end of a **minor** rabbinic fast (17 Tammuz, 10 Tevet, Tzom Gedaliah, Taanit Esther). **Degree-based**, attributed to the poskim myzmanim's *calculator* uses (each matched to the second against myzmanim at Rosh HaAyin): `tzaisGeonim` 5.95° = **Baal HaTanya** (Siddur Admur haZaken), `tzaisGeonim645` 6.45° = **R' Tukachinsky**, `tzaisGeonim7083` 7.083° = **R' Moshe Feinstein**. The KosherJava context (Geonim depression angle, three medium stars) is kept in the description text. (Fixed-minute poskim figures were dropped — location-specific, and myzmanim renders these as degrees.)
- **`nightfall`** — three *small* stars: the stringent end. `tzais` 8.5°, `tzais42`, `tzais72` (Rabbeinu Tam).

Every fast — minor or **Tisha B'Av** — offers the whole catalog; the `kind` split is only a settings grouping, not a per-fast filter. Which opinions actually display is the user's **configurable** `hiddenFastEnd` hide-list — three distinct defaults (Baal HaTanya 5.95° / R' Moshe 7.083° / small-stars 8.5°), applied only once `fastEndCustomized` (so default tweaks reach users who never touched the picker). The calendar grid and exports ignore the hide-list and always show the *earliest* opinion (`getDayEvents(..., [])`, keep the first fastEnd), since a cell has room for one. Labels are **not** stored here: each opinion resolves to `zmanim.shitot` through `fastEndZmanKey`, the same way havdalah resolves through `havdalahZmanKey` (see “One label register” below). The picker is a section in calendar-settings grouped by `kind`.

### Israel vs diaspora

`location.inIsrael` (`tz === 'Asia/Jerusalem'`) is threaded into `getDayInfo`/`getDayEvents` via `jc.setInIsrael(...)`. It changes the **parsha schedule** (Israel and the diaspora diverge for several weeks after a festival) and **1- vs 2-day Yom Tov**. Persisted localStorage locations that predate the `inIsrael` field are backfilled.

### Week parsha

`kosher-zmanim`'s `getUpcomingParsha()` throws in 0.9, so this week's parsha (the upcoming Shabbat's, shown on weekdays too) is computed by walking forward to the coming Saturday and reading that day's parsha — with `inIsrael` applied so it matches the location's schedule.

## Description accuracy notes

The descriptions were rewritten to match authoritative sources. Watch these when editing:

- **One label register.** A shita's label lives in `zmanim.shitot` and nowhere else. Anything that names an opinion — fast ends, havdalah, exports — stores a zman KEY and resolves the label through it (`fastEndZmanKey`, `havdalahZmanKey`) rather than keeping strings of its own. Two parallel blocks have drifted this way already: `shitotPrint` went stale against `shitot`, and `events.fastEndOpinions` still read "Рабейну Там · 72 мин фикс." after the shitot were rewritten, so one nightfall appeared two ways depending on the surface. Narrower forms for tight print columns are the one exception, and they are **sparse overrides that fall back** to the canonical label (`zmanim/labels.ts`) — never independent copies.
- **Seasonal ("proportional") hour** is the term used throughout for a `sha'ah zmanis` — a twelfth of the halachic day, longer in summer than in winter. Prefer it over "proportional/relative hour" for consistency.
- **The three day-length schools.** *GRA* (Vilna Gaon): day = sunrise→sunset. *Magen Avraham*: day = dawn→nightfall — its "72-minute" form uses alos 72 → tzais 72, and it also has 90-minute / 18° / 16.1° forms (each measured dawn→nightfall at that anchor). *Baal HaTanya*: day = **his own** sunrise/sunset (a slight below-horizon adjustment), so his Sof-zman / Mincha / Plag / Tzeit are all measured between those. Say which day a shita uses.
- **Alos 72 minutes** is a fixed 72 min before sunrise (4 mil × 18 min; Rambam/Rishonim). It is **not** the Magen Avraham's figure — the MGA is the authority who *uses* an alos-72 day for its seasonal-hour zmanim.
- **Degree-based zmanim** (alos 16.1°/18°/19.8°/16.9°, misheyakir 11.5→7.65°, tzeis 5.95°/6.45°/7.083°/8.5°/16.1°/18°): the depression angle is the real, location-independent definition. The "≈ X min before sunrise/after sunset" figure is only the **Jerusalem-equinox anchor** used to derive the angle and **varies by latitude and season** — keep the "in Jerusalem near the equinox; varies by place and season" qualifier. The equinox anchors are computed by our own engine, so they must match the golden fixtures: misheyakir 11.5/11/10.2/9.5/7.65° ≈ 50/48/44/41/32 min; tzeis 5.95/6.45/7.083/8.5° ≈ 24/26/29/36 min.
- **Tzeis 8.5°** = "three small stars," the mainstream nightfall, per **Rabbi Meir Posen (Ohr Meir)**. Cross-validated against myzmanim's calculator (Rosh HaAyin, to the second), the early degree tzeitim are the poskim's own: **5.95° = Baal HaTanya** (Siddur Admur haZaken; `getTzaisGeonim5Point95Degrees`), **6.45° = R' Tukachinsky**, **7.083° = R' Moshe Feinstein** — the last two being the **three-medium-stars** end of a minor rabbinic fast. Labels credit the posek; the Geonim/three-medium-stars context stays in the description. (The redundant 6° `getTzaisBaalHatanya` was dropped in favor of the 5.95° that matches myzmanim.)
- **Fixed / proportional minute tzeitim**: 42 min (common practical), 50 min = **Rav Moshe Feinstein / Igros Moshe** (NY area), 60/90 min (stringent), 72 min = **Rabbeinu Tam** (also as 16.1° and 72 proportional-minute forms), Ateret Torah = fixed 40 min after sunset (Chacham Yosef Harari-Raful).
- **Sof zman Shma/Tefila**: end of the 3rd / 4th seasonal hour. GRA measures the day sunrise→sunset; MGA measures alos→tzeis (its 72/90-minute or 16.1/18° day), giving an earlier deadline.
- **Vatikin**: complete Shema *just before* sunrise and begin the Amidah *at* netz.

The picker UI for all these opinions (both the settings visibility picker and the export column picker) is the shared `ZmanBaseControl` in `src/components/zmanim/zman-picker.tsx`: one collapsible row per base, a tri-state "toggle all" checkbox, and a selected/total count — so a base with a dozen Tzeit opinions never floods the list.

## Translations

Terminology is unified with the companion `zmanim_bot` (transliterated zman names; readable opinion labels). Only **Russian** holiday names are overridden (`holidays-ru.ts`, keyed by `kosher-zmanim`'s `getYomTovIndex()`); Hebrew and English holiday and parsha names come from the library's `HebrewDateFormatter`. The visible caption (`baseDescriptions`) should stay halachically accurate; the per-opinion `descriptions` carry the degree/attribution detail.
