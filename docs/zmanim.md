# Zmanim domain

The halachic engine and calendar logic. This is the safety-critical part of the app — changes here need tests that pin expected behavior, and halachic meanings should be verified against authoritative sources, not memory.

Sources used for the descriptions and definitions:
- KosherJava javadocs (authoritative for the library this app uses) — <https://kosherjava.com/zmanim/docs/api/>
- myzmanim.com degrees/explanations — <https://www.myzmanim.com/read/degrees.aspx>
- Chabad.org "About Our Zmanim Calculations" — <https://www.chabad.org/library/article_cdo/aid/3209349>

## `definitions.ts` — the single source of truth

`src/lib/zmanim/definitions.ts` binds each displayed zman to an exact `kosher-zmanim` method. Each entry is `{ key, base, method, category, order, erevOnly? }`:

- `key` — stable id used to look up the name/shita/description in the message catalogs (`zmanim.names` / `zmanim.shitot` / `zmanim.descriptions`).
- `base` — groups opinions of the same zman (e.g. `alos`, `misheyakir`, `sofZmanShma`, `sofZmanTfila`, `tzais`).
- `method` — the `ComplexZmanimCalendar` method to call.
- `category` — day-part for sectioning (`dawn`/`morning`/`midday`/`afternoon`/`evening`).
- `order` — display order (strictly increasing).
- `erevOnly` — `candleLighting` only.

`definitions.test.ts` enforces the invariants: every `method` exists on the calendar prototype, keys are unique, `order` is strictly increasing, and the **exact `key → method` mapping is locked** — so a zman can never silently start being shown under the wrong name or computed by the wrong method. If you add/rename a zman, update the locked mapping test deliberately.

## `calculator.ts` — timezone-correct computation

`computeZmanim({ lat, lng, date, elevation = 0, timeZoneId?, candleLightingOffset = 18 })` returns `{ key, time, erevOnly }[]`.

**The critical detail:** the calendar day is established by constructing *noon in the target zone from date components*:

```ts
const localNoon = DateTime.fromObject(
  { year, month, day, hour: 12 },
  { zone: timeZoneId },
);
```

Do **not** `setZone()` an existing instant to get the day — that shifts the calendar day across timezone/DST boundaries and produces times for the wrong day. `kosher-zmanim` returns each result as a UTC `DateTime`, which is then converted with `.setZone(timeZoneId)` for display. A golden test (validated to the second against Hebcal across Jerusalem, Brooklyn, London, Buenos Aires, LA) guards this, alongside invariant sweeps (chronological ordering over a lat/lng/date grid) and edge cases (polar day/night, DST, elevation, offset).

`candleLighting` is computed for **every** day (sunset − offset). It is only meaningful on Erev Shabbat / Erev Yom Tov; callers must filter it (the panel's times strip and `NextZman` both gate it on "erev").

## `groups.ts` — display grouping

`buildZmanimGroups(zmanim, translators)` produces a two-level structure:

1. by `category` (day-part) → `ZmanGroup`
2. within a group, by `base` → `ZmanBaseGroup` with `rows: ZmanRow[]` (one per shita/opinion)

Each base's visible caption is `baseDescriptions[base]` when there are multiple opinions, or the single row's `descriptions[key]` when there's one. The **per-opinion** detail (`descriptions[key]`) is shown behind the info popover, not inline (see `ShitaInfo`).

## Calendar classification (`day-info.ts`, `day-events.ts`)

- `getDayInfo(date, formatter?, locale, inIsrael)` → category, holiday label, `yomTovIndex`, `dayOfChanukah`, `isRoshChodesh`, `isShabbos`, `parsha`, `weekParsha`, `omer`, `isShabbosMevorchim`, Hebrew date.
- `classify()` precedence matters because `isYomTov()` is broad. **Chanukah is checked first and classified as `weekday`** (it's a minor festival; `isYomTov()` reports it as a Yom Tov). Order: chanukah → cholHamoed → erevYomTov → yomTov → taanis → roshChodesh → shabbos → weekday.
- `getDayEvents(date, times, inIsrael)` → candle lighting / havdalah / fast start / fast end. It uses **`isYomTovAssurBemelacha()`** (work-prohibited), NOT `isYomTov()`, to decide what's a "rest day." Tisha B'Av onset shows on its eve; Yom Kippur's end is havdalah (no duplicate nightfall).

### Israel vs diaspora

`location.inIsrael` (`tz === 'Asia/Jerusalem'`) is threaded into `getDayInfo`/`getDayEvents` via `jc.setInIsrael(...)`. It changes the **parsha schedule** (Israel and the diaspora diverge for several weeks after a festival) and **1- vs 2-day Yom Tov**. Persisted localStorage locations that predate the `inIsrael` field are backfilled.

### Week parsha

`kosher-zmanim`'s `getUpcomingParsha()` throws in 0.9, so this week's parsha (the upcoming Shabbat's, shown on weekdays too) is computed by walking forward to the coming Saturday and reading that day's parsha — with `inIsrael` applied so it matches the location's schedule.

## Description accuracy notes

The descriptions were rewritten to match authoritative sources. Watch these when editing:

- **Alos 72 minutes** is a fixed 72 min before sunrise (4 mil × 18 min; Rambam/Rishonim). It is **not** the Magen Avraham's figure — the MGA is the authority who *uses* an alos-72 day for proportional-hour zmanim (sof zman shma/tefila).
- **Degree-based zmanim** (alos 16.1°, misheyakir 11.5/11/10.2°, tzeis 8.5°/5.95°): the depression angle is the real, location-independent definition. The "≈ X min before sunrise/after sunset" figure is only the **Jerusalem-equinox anchor** used to derive the angle and **varies by latitude and season** — keep the "in Jerusalem near the equinox; varies by place and season" qualifier.
- **Tzeis 8.5°** = "three small stars" (per KosherJava's Ohr Meir), a slightly stringent nightfall. **Tzeis 5.95°** = the Geonim / Baal HaTanya early, lenient nightfall (used by some to end rabbinic fasts) — do not label it "small stars."
- **Sof zman Shma/Tefila**: end of the 3rd / 4th proportional (`sha'ah zmanis`) hour. GRA measures the day sunrise→sunset; MGA measures alos(72)→tzeis(72), giving an earlier deadline.
- **Vatikin**: complete Shema *just before* sunrise and begin the Amidah *at* netz.

## Translations

Terminology is unified with the companion `zmanim_bot` (transliterated zman names; readable opinion labels). Only **Russian** holiday names are overridden (`holidays-ru.ts`, keyed by `kosher-zmanim`'s `getYomTovIndex()`); Hebrew and English holiday and parsha names come from the library's `HebrewDateFormatter`. The visible caption (`baseDescriptions`) should stay halachically accurate; the per-opinion `descriptions` carry the degree/attribution detail.
