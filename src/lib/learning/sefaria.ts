import shekalimMap from '@hebcal/learning/shekalimDafYomiMap.json';
import vilnaMap from '@hebcal/learning/yerushalmiVilnaMap.json';

/**
 * Sefaria deep links for daily-learning readings. The URL formats mirror
 * `@hebcal/learning`'s own Event `url()` implementations (which we can't
 * import without dragging in `@hebcal/core`), including their quirks:
 *
 * - Daf Yomi Shekalim follows the Yerushalmi text on Sefaria, via the
 *   daf → chapter:halacha map shipped with the library.
 * - Kinnim and Midot aren't paginated by daf on Sefaria (they're printed in
 *   the Meilah volume), so those link to dafyomi.org like Hebcal does.
 * - Yerushalmi Yomi (Vilna pagination) maps each daf to its
 *   chapter:halacha range on Sefaria.
 */

/** Bavli tractates whose hebcal spelling differs from Sefaria's canonical name. */
const DAF_YOMI_SEFARIA: Record<string, string> = {
  Berachot: 'Berakhot',
  'Rosh Hashana': 'Rosh Hashanah',
  Gitin: 'Gittin',
  'Baba Kamma': 'Bava Kamma',
  'Baba Metzia': 'Bava Metzia',
  'Baba Batra': 'Bava Batra',
  Bechorot: 'Bekhorot',
  Arachin: 'Arakhin',
  Midot: 'Middot',
};

const SHEKALIM_MAP = shekalimMap as Record<string, string | undefined>;
const VILNA_MAP = vilnaMap as Record<string, (string | null)[] | undefined>;

/** Sefaria's interface-language parameter: Hebrew UI for he, bilingual otherwise. */
function sefariaLang(locale: string): string {
  return locale === 'he' ? 'he' : 'bi';
}

function sefariaUrl(book: string, ref: string | number, locale: string): string {
  const slug = encodeURIComponent(`${book}.${ref}`.replaceAll(' ', '_'));
  return `https://www.sefaria.org/${slug}?lang=${sefariaLang(locale)}`;
}

export function dafYomiUrl(tractate: string, blatt: number | string, locale: string): string | undefined {
  if (tractate === 'Kinnim' || tractate === 'Midot') {
    return `https://www.dafyomi.org/index.php?masechta=meilah&daf=${blatt}a`;
  }
  if (tractate === 'Shekalim') {
    const aEntry = SHEKALIM_MAP[`${blatt}a`];
    const bEntry = SHEKALIM_MAP[`${blatt}b`];
    if (!aEntry || !bEntry) return undefined;
    const start = aEntry.split('-')[0];
    const end = bEntry.includes('-') ? bEntry.split('-')[1] : bEntry;
    return sefariaUrl('Jerusalem Talmud Shekalim', `${start}-${end}`.replaceAll(':', '.'), locale);
  }
  return sefariaUrl(DAF_YOMI_SEFARIA[tractate] ?? tractate, `${blatt}a`, locale);
}

export function yerushalmiYomiUrl(tractate: string, blatt: number, locale: string): string | undefined {
  const verses = VILNA_MAP[tractate]?.[blatt - 1];
  if (typeof verses !== 'string') return undefined;
  return sefariaUrl(`Jerusalem Talmud ${tractate}`, verses.replaceAll(':', '.'), locale);
}

export function mishnaYomitUrl(pair: readonly { k: string; v: string }[], locale: string): string | undefined {
  const [a, b] = pair;
  if (!a || !b) return undefined;
  const book = a.k === 'Avot' ? 'Pirkei Avot' : `Mishnah ${a.k}`;
  // Second mishna in a different tractate → link just the first one.
  if (a.k !== b.k) return sefariaUrl(book, a.v.replace(':', '.'), locale);
  const [chapterA, mishnaA] = a.v.split(':');
  const [chapterB, mishnaB] = b.v.split(':');
  const end = chapterA === chapterB ? mishnaB : `${chapterB}.${mishnaB}`;
  return sefariaUrl(book, `${chapterA}.${mishnaA}-${end}`, locale);
}

export function nachYomiUrl(book: string, chapter: number, locale: string): string {
  return sefariaUrl(book, chapter, locale);
}

export function tehillimUrl(begin: number | string, end: number | string, locale: string): string {
  return sefariaUrl('Psalms', `${begin}-${end}`.replaceAll(':', '.'), locale);
}

export function rambamUrl(section: string, perek: number | string, locale: string): string {
  return sefariaUrl(`Mishneh Torah, ${section}`, String(perek).replaceAll(':', '.'), locale);
}

export function pirkeiAvotUrl(chapters: readonly number[], locale: string): string {
  return sefariaUrl('Pirkei Avot', chapters.join('-'), locale);
}
