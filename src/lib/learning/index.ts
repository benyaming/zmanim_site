import { getAbsDate } from '@hebcal/learning/common';
import { DafYomi, osday as dafYomiStart } from '@hebcal/learning/dafYomiBase';
import { MishnaYomiIndex, mishnaYomiStart, type MishnaYomi } from '@hebcal/learning/mishnaYomiBase';
import { NachYomiIndex, nachYomiStart } from '@hebcal/learning/nachYomiBase';
import { pirkeiAvot } from '@hebcal/learning/pirkeiAvotBase';
import { dailyPsalms } from '@hebcal/learning/psalmsBase';
import { dailyRambam1, rambam1Start } from '@hebcal/learning/rambam1Base';
import { vilna, yerushalmiYomi } from '@hebcal/learning/yerushalmiBase';
import type { DateTime } from 'luxon';

import { learningName } from './names';
import {
  dafYomiUrl,
  mishnaYomitUrl,
  nachYomiUrl,
  pirkeiAvotUrl,
  rambamUrl,
  tehillimUrl,
  yerushalmiYomiUrl,
} from './sefaria';

export type LearningCycleKey =
  | 'dafYomi'
  | 'yerushalmiYomi'
  | 'mishnaYomit'
  | 'nachYomi'
  | 'tehillim'
  | 'rambam'
  | 'pirkeiAvot';

/** All cycles, in the panel's display order — the settings picker mirrors it. */
export const LEARNING_CYCLE_KEYS: readonly LearningCycleKey[] = [
  'dafYomi',
  'yerushalmiYomi',
  'mishnaYomit',
  'nachYomi',
  'tehillim',
  'rambam',
  'pirkeiAvot',
];

const LEARNING_KEY_SET: ReadonlySet<string> = new Set(LEARNING_CYCLE_KEYS);

/** Drop unknown/duplicate keys from a persisted hidden-learning list (self-heals stale saves). */
export function sanitizeHiddenLearning(value: unknown): LearningCycleKey[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((k): k is LearningCycleKey => typeof k === 'string' && LEARNING_KEY_SET.has(k)))];
}

export interface DailyLearningItem {
  key: LearningCycleKey;
  /** Localized reading reference, e.g. "Berachot 21" / "ברכות 21" / "Брахот 21". */
  reading: string;
  /** Deep link to the reading on sefaria.org (dafyomi.org for the two tractates Sefaria lacks by daf). */
  url?: string;
}

// Both indexes precompute one full cycle of lookup tables; build them once.
const mishnaIndex = new MishnaYomiIndex();
const nachIndex = new NachYomiIndex();

/** The word before a Pirkei Avot chapter number (the only reading with no name of its own). */
const CHAPTER_WORD: Record<string, string> = { en: 'Chapter', he: 'פרק', ru: 'Глава' };

/**
 * Convert a calendar day to a plain JS Date carrying the same civil date.
 * Built from date components (never from the instant), so the reading matches
 * the day shown in the calendar regardless of the viewer's timezone — same
 * rule as the zmanim calculator (see CLAUDE.md → timezone day handling).
 */
function toJsDate(date: DateTime): Date {
  const d = new Date(2000, date.month - 1, date.day, 12);
  d.setFullYear(date.year);
  return d;
}

/** "Kelim 16:2–3" (same chapter), "Kelim 16:8–17:1", or "Shabbat 24:5 – Eruvin 1:1". */
function formatMishnaPair([a, b]: MishnaYomi[], locale: string): string {
  const nameA = learningName(a.k, locale);
  if (a.k !== b.k) return `${nameA} ${a.v} – ${learningName(b.k, locale)} ${b.v}`;
  const [chapterA] = a.v.split(':');
  const [chapterB, mishnaB] = b.v.split(':');
  return chapterA === chapterB ? `${nameA} ${a.v}–${mishnaB}` : `${nameA} ${a.v}–${b.v}`;
}

/** "97–103", or the Psalm 119 split days as "119:1–96" / "119:97–176". */
function formatPsalms(begin: number | string, end: number | string): string {
  const [chapterB] = String(begin).split(':');
  const [chapterE, verseE] = String(end).split(':');
  return chapterB === chapterE && verseE ? `${begin}–${verseE}` : `${begin}–${end}`;
}

/**
 * All daily-learning readings for a calendar day: Daf Yomi (Bavli), Yerushalmi
 * Yomi (Vilna cycle), Mishna Yomit, Nach Yomi, the monthly Tehillim portion,
 * Daily Rambam (one chapter) and — on the relevant Shabbatot — Pirkei Avot.
 *
 * Cycles that had not yet begun on the given date are omitted (each has a
 * historical start date); Yerushalmi is omitted on Yom Kippur and Tisha BeAv,
 * when that cycle skips a day.
 */
export function getDailyLearning(date: DateTime, inIsrael: boolean, locale: string): DailyLearningItem[] {
  const jsDate = toJsDate(date);
  const abs = getAbsDate(jsDate);
  const items: DailyLearningItem[] = [];

  if (abs >= dafYomiStart) {
    const daf = new DafYomi(jsDate);
    items.push({
      key: 'dafYomi',
      reading: `${learningName(daf.getName(), locale)} ${daf.getBlatt()}`,
      url: dafYomiUrl(daf.getName(), daf.getBlatt(), locale),
    });
  }

  if (abs >= vilna.startAbs) {
    const daf = yerushalmiYomi(jsDate, vilna);
    if (daf) {
      items.push({
        key: 'yerushalmiYomi',
        reading: `${learningName(daf.name, locale)} ${daf.blatt}`,
        url: yerushalmiYomiUrl(daf.name, daf.blatt, locale),
      });
    }
  }

  if (abs >= mishnaYomiStart) {
    const pair = mishnaIndex.lookup(jsDate);
    items.push({
      key: 'mishnaYomit',
      reading: formatMishnaPair(pair, locale),
      url: mishnaYomitUrl(pair, locale),
    });
  }

  if (abs >= nachYomiStart) {
    const chapter = nachIndex.lookup(jsDate);
    items.push({
      key: 'nachYomi',
      reading: `${learningName(chapter.k, locale)} ${chapter.v}`,
      url: nachYomiUrl(chapter.k, chapter.v, locale),
    });
  }

  const [begin, end] = dailyPsalms(jsDate);
  items.push({ key: 'tehillim', reading: formatPsalms(begin, end), url: tehillimUrl(begin, end, locale) });

  if (abs >= rambam1Start) {
    const reading = dailyRambam1(jsDate);
    items.push({
      key: 'rambam',
      reading: `${learningName(reading.name, locale)} ${reading.perek}`,
      url: rambamUrl(reading.name, reading.perek, locale),
    });
  }

  const avotChapters = pirkeiAvot(jsDate, inIsrael);
  if (avotChapters) {
    items.push({
      key: 'pirkeiAvot',
      reading: `${CHAPTER_WORD[locale] ?? CHAPTER_WORD.en} ${avotChapters.join('–')}`,
      url: pirkeiAvotUrl(avotChapters, locale),
    });
  }

  return items;
}
