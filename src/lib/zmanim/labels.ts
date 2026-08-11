import { ZMANIM } from './definitions';

/**
 * The label registers, and the fallback between them.
 *
 * A zman's name and a shita's label each exist at up to three widths, and only
 * the widest is mandatory. The narrower ones are SPARSE overrides, supplied
 * where a full label would not fit the column that renders it and omitted
 * everywhere else:
 *
 *   names[key]         →  namesShort[base]   →  abbr[base]
 *   (app, always)         (PDF headers)         (month-grid cells)
 *
 *   shitot[key]        →  shitotShort[key]
 *   (app, picker,         (month-sheet columns,
 *    weekly sheet)         footer blocks)
 *
 * Resolution walks DOWN to the narrowest register that exists and falls back UP
 * when it does not, so a new zman needs exactly one label to render everywhere
 * and gains a tighter one only when a sheet actually demands it. This replaces
 * the older arrangement of three complete parallel dictionaries (`shitotPrint`
 * among them) which had to be edited in triplicate and drifted apart — the long
 * labels had gone stale while the short ones stayed correct.
 *
 * It also replaces the regex that used to derive a short name by stripping a
 * translated name's parenthetical: that worked only where a translator had
 * happened to write one, so "Выход звезд" and "Зажигание свечей" came through a
 * column header at full width.
 */

/** The subset of a next-intl translator this needs: callable, plus `has`. */
export interface LabelTranslator {
  (key: string): string;
  has(key: string): boolean;
}

/** First defined zman key of a base — the key its `names` entry is stored under. */
const BASE_FIRST_KEY = new Map<string, string>();
for (const z of ZMANIM) if (!BASE_FIRST_KEY.has(z.base)) BASE_FIRST_KEY.set(z.base, z.key);

const BASE_OF_KEY = new Map<string, string>(ZMANIM.map((z) => [z.key, z.base]));

export interface ZmanLabels {
  /** Full zman name, e.g. "Алот а-шахар (заря)". */
  name(key: string): string;
  /** Column-header name for a base, e.g. "Алот". Falls back to the full name. */
  nameShort(base: string): string;
  /** Tightest name for a base, e.g. "Алот" in a grid cell. Falls back to nameShort. */
  abbr(base: string): string;
  /** Canonical shita label, e.g. "Маген Авраам · алот 16,1°". May be empty. */
  shita(key: string): string;
  /** Narrow shita label, e.g. "МА 16,1°". Falls back to the canonical one. */
  shitaShort(key: string): string;
}

/**
 * Build the label accessors over a ROOT-scoped translator (paths begin
 * `zmanim.`), which is what the export tools hold. Components already scoped to
 * a single sub-namespace read that dictionary directly and need none of this.
 */
export function zmanLabels(tr: LabelTranslator): ZmanLabels {
  const name = (key: string) => tr(`zmanim.names.${key}`);

  const nameShort = (base: string) => {
    if (tr.has(`zmanim.namesShort.${base}`)) return tr(`zmanim.namesShort.${base}`);
    const key = BASE_FIRST_KEY.get(base);
    return key ? name(key) : base;
  };

  return {
    name,
    nameShort,
    abbr: (base: string) => (tr.has(`zmanim.abbr.${base}`) ? tr(`zmanim.abbr.${base}`) : nameShort(base)),
    shita: (key: string) => tr(`zmanim.shitot.${key}`),
    shitaShort: (key: string) =>
      tr.has(`zmanim.shitotShort.${key}`) ? tr(`zmanim.shitotShort.${key}`) : tr(`zmanim.shitot.${key}`),
  };
}

/** The base a zman key belongs to, for callers that only hold the key. */
export function baseOfZmanKey(key: string): string | undefined {
  return BASE_OF_KEY.get(key);
}

/** Column-header name for a zman KEY (resolved through its base). */
export function zmanNameShortForKey(labels: ZmanLabels, key: string): string {
  const base = BASE_OF_KEY.get(key);
  return base ? labels.nameShort(base) : labels.name(key);
}
