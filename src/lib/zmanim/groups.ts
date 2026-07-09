import type { DateTime } from 'luxon';

import type { ComputedZman, ZmanCategory } from './types';

export interface ZmanRow {
  key: string;
  /** Calculation opinion / method sub-label (e.g. "Magen Avraham", "8.5°"). May be empty. */
  shita: string;
  /** Detailed clarification for this opinion — shown on hover, not inline. */
  detail: string;
  time: DateTime | null;
  /** Set (possibly null) only for duration zmanim — rendered as h:mm:ss instead of a clock time. */
  durationMillis?: number | null;
}

/** A base zman and its one-or-more shitot (e.g. "Misheyakir" → 11.5° / 11° / 10.2°). */
export interface ZmanBaseGroup {
  base: string;
  name: string;
  /** Short, general description of the zman (shown behind the name's info popover). */
  description: string;
  rows: ZmanRow[];
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
  group: (category: string) => string;
}

const GROUP_ORDER: ZmanCategory[] = ['dawn', 'morning', 'midday', 'afternoon', 'evening'];

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
 */
export function buildZmanimGroups(zmanim: ComputedZman[], t: ZmanTranslators): ZmanGroup[] {
  const byCategory = new Map<ZmanCategory, Map<string, ZmanBaseGroup>>();

  for (const z of zmanim) {
    const bases = byCategory.get(z.category) ?? new Map<string, ZmanBaseGroup>();
    byCategory.set(z.category, bases);

    const group = bases.get(z.base) ?? { base: z.base, name: t.name(z.key), description: '', rows: [] };
    group.rows.push({
      key: z.key,
      shita: t.shita(z.key),
      detail: t.detail(z.key),
      time: z.time,
      ...(z.duration ? { durationMillis: z.durationMillis ?? null } : {}),
    });
    bases.set(z.base, group);
  }

  return GROUP_ORDER.filter((c) => byCategory.has(c)).map((category) => {
    const items = [...byCategory.get(category)!.values()].map((group) => {
      const rows = [...group.rows].sort((a, b) => rowTimeMs(a) - rowTimeMs(b));
      return {
        ...group,
        rows,
        // Single opinion → its own detail is the description. Multiple → the general base description.
        description: rows.length > 1 ? t.baseDescription(group.base) : rows[0].detail,
      };
    });
    items.sort((a, b) => rowTimeMs(a.rows[0]) - rowTimeMs(b.rows[0]));
    return { category, label: t.group(category), items };
  });
}
