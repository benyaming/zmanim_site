import poHe from '@hebcal/learning/he.po';

import { LEARNING_NAMES_RU } from './names-ru';

/**
 * Hebrew names shipped with `@hebcal/learning` itself (a plain data module —
 * it does not pull in `@hebcal/core`). Covers every tractate, Tanach book and
 * Mishneh Torah section used by the cycles.
 */
const NAMES_HE = poHe.contexts[''] as Record<string, string[] | undefined>;

/**
 * The two names `@hebcal/learning`'s catalog leaves to `@hebcal/core` (which
 * we deliberately don't bundle). The completeness test enumerates every
 * reachable name, so a future gap fails loudly instead of leaking English.
 */
const NAMES_HE_EXTRA: Record<string, string> = {
  Shabbat: 'שבת',
  'Rosh Hashana': 'ראש השנה',
};

/**
 * Localized display name for a daily-learning reading (tractate, Tanach book
 * or Mishneh Torah section), keyed by the English name `@hebcal/learning`
 * returns. Unknown keys fall back to the English key so a data update in the
 * library can never blank out a reading.
 */
export function learningName(key: string, locale: string): string {
  if (locale === 'he') return NAMES_HE[key]?.[0] ?? NAMES_HE_EXTRA[key] ?? key;
  if (locale === 'ru') return LEARNING_NAMES_RU[key] ?? key;
  return key;
}
