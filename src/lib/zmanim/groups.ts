import type { DateTime } from 'luxon';

import type { ComputedZman, ZmanCategory } from './types';

export interface ZmanRow {
  key: string;
  /** Calculation opinion / method sub-label (e.g. "Magen Avraham", "8.5°"). May be empty. */
  shita: string;
  /** Detailed clarification for this opinion — shown on hover, not inline. */
  detail: string;
  time: DateTime | null;
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
 * Group computed zmanim by day-part, and within each by base zman, so that the
 * several opinions of one zman are shown together under a single name. The base
 * description and each per-opinion detail are tucked behind info popovers.
 */
export function buildZmanimGroups(zmanim: ComputedZman[], t: ZmanTranslators): ZmanGroup[] {
  const byCategory = new Map<ZmanCategory, Map<string, ZmanBaseGroup>>();

  for (const z of zmanim) {
    const bases = byCategory.get(z.category) ?? new Map<string, ZmanBaseGroup>();
    byCategory.set(z.category, bases);

    const group = bases.get(z.base) ?? { base: z.base, name: t.name(z.key), description: '', rows: [] };
    group.rows.push({ key: z.key, shita: t.shita(z.key), detail: t.detail(z.key), time: z.time });
    bases.set(z.base, group);
  }

  return GROUP_ORDER.filter((c) => byCategory.has(c)).map((category) => ({
    category,
    label: t.group(category),
    items: [...byCategory.get(category)!.values()].map((group) => ({
      ...group,
      // Single opinion → its own detail is the description. Multiple → the general base description.
      description: group.rows.length > 1 ? t.baseDescription(group.base) : group.rows[0].detail,
    })),
  }));
}
