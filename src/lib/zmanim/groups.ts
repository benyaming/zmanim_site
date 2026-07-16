import type { DateTime } from 'luxon';

import type { ComputedZman, ZmanCategory, ZmanFamily } from './types';

export interface ZmanRow {
  key: string;
  /** Calculation opinion / method sub-label (e.g. "Magen Avraham", "8.5°"). May be empty. */
  shita: string;
  /** Detailed clarification for this opinion — shown on hover, not inline. */
  detail: string;
  time: DateTime | null;
  /** How this opinion is calculated — drives the empty-state explanation. */
  family: ZmanFamily;
  /** Set (possibly null) only for duration zmanim — rendered as h:mm:ss instead of a clock time. */
  durationMillis?: number | null;
}

/**
 * The shitot of one base zman that share a calculation method (see `ZmanFamily`).
 * Only worth surfacing when a base spans more than one — today that is Alot,
 * Tzeit and Mincha Gedola; every other base is single-family, where a header
 * would restate what the rows already say.
 */
export interface ZmanFamilyGroup {
  family: ZmanFamily;
  /** Localized family name, e.g. "By sun angle". */
  label: string;
  /** What this family of opinions actually measures (shown behind an info popover). */
  description: string;
  rows: ZmanRow[];
}

/** A base zman and its one-or-more shitot (e.g. "Misheyakir" → 11.5° / 11° / 10.2°). */
export interface ZmanBaseGroup {
  base: string;
  name: string;
  /** Short, general description of the zman (shown behind the name's info popover). */
  description: string;
  /** Every shita, in chronological order, whatever its family. */
  rows: ZmanRow[];
  /** The same rows partitioned by calculation family, in canonical family order. */
  families: ZmanFamilyGroup[];
  /**
   * Whether the panel should show family sub-headings for this base. True only
   * when at least TWO families each carry more than one opinion — the point at
   * which the split earns its headings. A base with one dominant family and a
   * lone outlier (e.g. Mincha Gedola: three sunrise-to-sunset opinions plus the
   * single fixed-30 and the single MGA) reads better as a flat chronological
   * list, so this is false and the renderer ignores `families`.
   */
  grouped: boolean;
}

export interface ZmanGroup {
  category: ZmanCategory;
  label: string;
  items: ZmanBaseGroup[];
}

/** Translation lookups the grouping needs (compatible with next-intl's `t`). */
export interface ZmanTranslators {
  name: (key: string) => string;
  shita: (key: string) => string;
  /** Per-key detailed clarification (info popover). */
  detail: (key: string) => string;
  /** General description for a multi-opinion base zman. */
  baseDescription: (base: string) => string;
  /** Name of a calculation family, e.g. "By sun angle". */
  familyLabel: (family: ZmanFamily) => string;
  /** What a calculation family measures (info popover on the family heading). */
  familyDescription: (family: ZmanFamily) => string;
  group: (category: string) => string;
}

const GROUP_ORDER: ZmanCategory[] = ['dawn', 'morning', 'midday', 'afternoon', 'evening'];

/**
 * Canonical family order within a base — deliberately FIXED, not chronological.
 *
 * Rows inside a family stay in time order, but the families themselves do not
 * compete on time: they are different answers to the same question, and their
 * relative order shifts with latitude and season (a fixed-90 dawn precedes the
 * 19.8° one in Jerusalem and follows it in Düsseldorf). Sorting the headings by
 * time would make the panel's structure move around under the reader for no
 * gain, and would imply a chronology across families that isn't being claimed.
 * A stable ladder — angles, then fixed minutes, then seasonal, then the two
 * day-definitions — is learnable and mirrors how myzmanim lays the opinions out.
 */
const FAMILY_ORDER: ZmanFamily[] = [
  'degrees',
  'fixedMinutes',
  'seasonalMinutes',
  'dawnToNightfall',
  'sunriseToSunset',
  'solar',
];

/**
 * Sort key by actual time. Undefined times and durations (shaah zmanis, whose
 * `time` is null) sort to the end; a stable sort keeps their definition order.
 */
const rowTimeMs = (row: ZmanRow): number => (row.time ? row.time.toMillis() : Number.POSITIVE_INFINITY);

/**
 * Group computed zmanim by day-part, and within each by base zman, so that the
 * several opinions of one zman are shown together under a single name. The base
 * description and each per-opinion detail are tucked behind info popovers.
 *
 * Rows are ordered by their ACTUAL time, not the definition order: the latter is
 * the Jerusalem-equinox order, but degree- vs fixed-minute opinions cross over
 * by latitude and season (e.g. alos 19.8° is well before fixed-90 in summer),
 * so a fixed order would read out of sequence elsewhere. Bases within a section
 * are likewise ordered by their earliest time, so each section flows top-to-bottom.
 *
 * Each base additionally carries its rows partitioned by calculation `family`,
 * for the renderer to show as sub-headings where a base spans more than one.
 * That containment is what lets the chronological sort above stay honest: within
 * a family, time order is meaningful; across families it never was, and the
 * headings say so rather than letting the methods interleave silently.
 */
export function buildZmanimGroups(zmanim: ComputedZman[], t: ZmanTranslators): ZmanGroup[] {
  const byCategory = new Map<ZmanCategory, Map<string, ZmanBaseGroup>>();

  for (const z of zmanim) {
    const bases = byCategory.get(z.category) ?? new Map<string, ZmanBaseGroup>();
    byCategory.set(z.category, bases);

    const group = bases.get(z.base) ?? {
      base: z.base,
      name: t.name(z.key),
      description: '',
      rows: [],
      families: [],
      grouped: false,
    };
    group.rows.push({
      key: z.key,
      shita: t.shita(z.key),
      detail: t.detail(z.key),
      time: z.time,
      family: z.family,
      ...(z.duration ? { durationMillis: z.durationMillis ?? null } : {}),
    });
    bases.set(z.base, group);
  }

  return GROUP_ORDER.filter((c) => byCategory.has(c)).map((category) => {
    const items = [...byCategory.get(category)!.values()].map((group) => {
      const rows = [...group.rows].sort((a, b) => rowTimeMs(a) - rowTimeMs(b));
      // Partition the (already chronological) rows by family, keeping only the
      // families this base actually has, in canonical order.
      const families: ZmanFamilyGroup[] = FAMILY_ORDER.filter((f) => rows.some((r) => r.family === f)).map((family) => ({
        family,
        label: t.familyLabel(family),
        description: t.familyDescription(family),
        rows: rows.filter((r) => r.family === family),
      }));
      // Headings earn their place only when ≥2 families each hold more than one
      // opinion (see ZmanBaseGroup.grouped).
      const grouped = families.filter((f) => f.rows.length > 1).length >= 2;
      return {
        ...group,
        rows,
        families,
        grouped,
        // Single opinion → its own detail is the description. Multiple → the general base description.
        description: rows.length > 1 ? t.baseDescription(group.base) : rows[0].detail,
      };
    });
    items.sort((a, b) => rowTimeMs(a.rows[0]) - rowTimeMs(b.rows[0]));
    return { category, label: t.group(category), items };
  });
}
