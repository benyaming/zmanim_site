import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { shas0 } from '@hebcal/learning/dafYomiBase';
import { MishnaYomiIndex, mishnaYomiStart } from '@hebcal/learning/mishnaYomiBase';
import { NachYomiIndex, nachYomiStart } from '@hebcal/learning/nachYomiBase';
import { mishnehTorah1 } from '@hebcal/learning/rambam1Base';
import { vilna } from '@hebcal/learning/yerushalmiBase';
import { JewishCalendar, YerushalmiYomiCalculator, YomiCalculator } from 'kosher-zmanim';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { getDailyLearning, LEARNING_CYCLE_KEYS, sanitizeHiddenLearning, type LearningCycleKey } from './index';
import { learningName } from './names';
import { LEARNING_NAMES_RU } from './names-ru';

const day = (iso: string, zone = 'Asia/Jerusalem') => DateTime.fromISO(iso, { zone }).set({ hour: 12 });

function reading(iso: string, key: LearningCycleKey, locale = 'en', inIsrael = false): string | undefined {
  return getDailyLearning(day(iso), inIsrael, locale).find((i) => i.key === key)?.reading;
}

describe('getDailyLearning — golden dates', () => {
  // Pinned against hebcal.com AND independently confirmed by sefaria.org
  // calendars API for the same dates.
  it('2026-07-05 (20 Tammuz 5786) matches Hebcal/Sefaria', () => {
    const items = Object.fromEntries(getDailyLearning(day('2026-07-05'), false, 'en').map((i) => [i.key, i.reading]));
    expect(items).toEqual({
      dafYomi: 'Chullin 66',
      yerushalmiYomi: 'Bava Metzia 20',
      mishnaYomit: 'Kelim 16:2–3',
      nachYomi: 'II Kings 22',
      tehillim: '97–103',
      rambam: 'Rest on a Holiday 4',
    });
  });

  it('2026-07-05 Sefaria links match the format hebcal publishes (spot-checked live, all 200)', () => {
    const urls = Object.fromEntries(getDailyLearning(day('2026-07-05'), false, 'en').map((i) => [i.key, i.url]));
    expect(urls).toEqual({
      dafYomi: 'https://www.sefaria.org/Chullin.66a?lang=bi',
      yerushalmiYomi: 'https://www.sefaria.org/Jerusalem_Talmud_Bava_Metzia.5.2.2-3.1?lang=bi',
      mishnaYomit: 'https://www.sefaria.org/Mishnah_Kelim.16.2-3?lang=bi',
      nachYomi: 'https://www.sefaria.org/II_Kings.22?lang=bi',
      tehillim: 'https://www.sefaria.org/Psalms.97-103?lang=bi',
      rambam: 'https://www.sefaria.org/Mishneh_Torah%2C_Rest_on_a_Holiday.4?lang=bi',
    });
  });

  it('2025-06-15 (19 Sivan 5785) matches Hebcal', () => {
    const items = Object.fromEntries(getDailyLearning(day('2025-06-15'), false, 'en').map((i) => [i.key, i.reading]));
    expect(items).toEqual({
      dafYomi: 'Shevuot 45',
      yerushalmiYomi: 'Yevamot 74',
      mishnaYomit: 'Avot 4:14–15',
      nachYomi: 'Psalms 121',
      tehillim: '90–96',
      rambam: 'Murderer and the Preservation of Life 12',
    });
  });

  it('localizes reading names (he / ru)', () => {
    expect(reading('2026-07-05', 'dafYomi', 'he')).toBe('חולין 66');
    expect(reading('2026-07-05', 'dafYomi', 'ru')).toBe('Хулин 66');
    expect(reading('2026-07-05', 'nachYomi', 'ru')).toBe('Млахим II 22');
    expect(reading('2026-07-05', 'rambam', 'ru')).toBe('Законы покоя в праздники 4');
  });

  it('splits Psalm 119 across the 25th–26th of the Hebrew month', () => {
    expect(reading('2026-07-10', 'tehillim')).toBe('119:1–96');
    expect(reading('2026-07-11', 'tehillim')).toBe('119:97–176');
  });
});

describe('getDailyLearning — Sefaria links', () => {
  function url(iso: string, key: LearningCycleKey, locale = 'en', inIsrael = false): string | undefined {
    return getDailyLearning(day(iso), inIsrael, locale).find((i) => i.key === key)?.url;
  }

  it('uses the Hebrew Sefaria interface for the he locale', () => {
    expect(url('2026-07-05', 'dafYomi', 'he')).toBe('https://www.sefaria.org/Chullin.66a?lang=he');
  });

  it('links tractate-name variants to Sefaria canonical spellings', () => {
    // 2024-08-01 is "Baba Batra 37" in hebcal's Ashkenazi spelling.
    expect(url('2024-08-01', 'dafYomi')).toBe('https://www.sefaria.org/Bava_Batra.37a?lang=bi');
  });

  it('links Daf Yomi Shekalim into the Yerushalmi text, Kinnim to dafyomi.org', () => {
    // Verified live: both resolve. Shekalim 2 spans two Yerushalmi refs;
    // Kinnim has no by-daf text on Sefaria, matching hebcal's fallback.
    expect(url('2028-08-24', 'dafYomi')).toBe('https://www.sefaria.org/Jerusalem_Talmud_Shekalim.1.1.1-10?lang=bi');
    expect(url('2027-03-13', 'dafYomi')).toBe('https://www.dafyomi.org/index.php?masechta=meilah&daf=23a');
  });

  it('links the Psalm 119 split and Pirkei Avot chapters', () => {
    expect(url('2026-07-10', 'tehillim')).toBe('https://www.sefaria.org/Psalms.119.1-119.96?lang=bi');
    expect(url('2026-07-11', 'pirkeiAvot', 'en', true)).toBe('https://www.sefaria.org/Pirkei_Avot.2?lang=bi');
  });

  it('every item of a regular day carries a URL', () => {
    for (const item of getDailyLearning(day('2026-07-05'), false, 'en')) {
      expect(item.url, item.key).toMatch(/^https:\/\//);
    }
  });
});

describe('getDailyLearning — Pirkei Avot', () => {
  it('appears only on Shabbat, within the Pesach → Rosh Hashanah window', () => {
    expect(reading('2026-07-11', 'pirkeiAvot', 'en')).toBe('Chapter 1'); // Shabbat
    expect(reading('2026-07-11', 'pirkeiAvot', 'ru')).toBe('Глава 1');
    expect(reading('2026-07-05', 'pirkeiAvot')).toBeUndefined(); // Sunday
    expect(reading('2026-01-17', 'pirkeiAvot')).toBeUndefined(); // Shabbat, winter
  });

  it('respects the Israel / diaspora schedule difference', () => {
    expect(reading('2026-07-11', 'pirkeiAvot', 'en', true)).toBe('Chapter 2');
  });
});

describe('getDailyLearning — cycle start guards', () => {
  it('omits cycles that had not started yet', () => {
    const keys = getDailyLearning(day('1900-01-01'), false, 'en').map((i) => i.key);
    expect(keys).toEqual(['tehillim']);

    const in1950 = getDailyLearning(day('1950-01-01'), false, 'en').map((i) => i.key);
    expect(in1950).toContain('dafYomi');
    expect(in1950).toContain('mishnaYomit');
    expect(in1950).not.toContain('nachYomi');
    expect(in1950).not.toContain('rambam');
    expect(in1950).not.toContain('yerushalmiYomi');
  });
});

describe('getDailyLearning — timezone day handling', () => {
  it('gives the same readings for the same civil date in any zone', () => {
    const zones = ['Pacific/Kiritimati', 'America/Anchorage', 'Asia/Jerusalem', 'UTC'];
    const readings = zones.map((zone) => JSON.stringify(getDailyLearning(day('2026-07-05', zone), false, 'en')));
    expect(new Set(readings).size).toBe(1);
  });
});

describe('cross-validation against kosher-zmanim', () => {
  // kosher-zmanim ships its own independent Daf Yomi implementations
  // (YomiCalculator / YerushalmiYomiCalculator). Both libraries must agree on
  // tractate and page for every day of a multi-year sweep.
  const shas0Names = shas0.map((d) => d.name);

  it('Daf Yomi Bavli agrees with YomiCalculator over 3 years', () => {
    for (let i = 0; i < 1100; i++) {
      const date = day('2024-01-01').plus({ days: i });
      const item = getDailyLearning(date, false, 'en').find((x) => x.key === 'dafYomi')!;
      const jc = new JewishCalendar(date);
      const kosherDaf = YomiCalculator.getDafYomiBavli(jc);
      const expected = `${shas0Names[kosherDaf.getMasechtaNumber()]} ${kosherDaf.getDaf()}`;
      expect(item.reading, date.toISODate()!).toBe(expected);
    }
  });

  it('Yerushalmi Yomi agrees with YerushalmiYomiCalculator over 3 years', () => {
    // kosher-zmanim 0.9 has an off-by-one bug on tractate-transition days: it
    // returns a page past the end of the finished tractate ("Shabbat 93" when
    // Vilna Shabbat has 92 dapim) instead of page 1 of the next one. Hebcal
    // and Sefaria agree on those days. So: agree everywhere, except that a
    // kosher-zmanim overflow must correspond to our "next tractate, page 1".
    const vilnaNames = vilna.shas.map(([name]) => name);
    const vilnaPages = vilna.shas.map(([, pages]) => pages);
    for (let i = 0; i < 1100; i++) {
      const date = day('2024-01-01').plus({ days: i });
      const item = getDailyLearning(date, false, 'en').find((x) => x.key === 'yerushalmiYomi');
      const jc = new JewishCalendar(date);
      const kosherDaf = YerushalmiYomiCalculator.getDafYomiYerushalmi(jc);
      if (kosherDaf === null) {
        // Yom Kippur / Tisha BeAv — both implementations must skip the day.
        expect(item, date.toISODate()!).toBeUndefined();
      } else if (kosherDaf.getDaf() > vilnaPages[kosherDaf.getMasechtaNumber()]) {
        const next = vilnaNames[(kosherDaf.getMasechtaNumber() + 1) % vilnaNames.length];
        expect(item?.reading, date.toISODate()!).toBe(`${next} 1`);
      } else {
        const expected = `${vilnaNames[kosherDaf.getMasechtaNumber()]} ${kosherDaf.getDaf()}`;
        expect(item?.reading, date.toISODate()!).toBe(expected);
      }
    }
  });
});

describe('GPL bundle guard', () => {
  // Only these core-free @hebcal/learning subpaths may be imported anywhere in
  // src/ — the package root and its *Event modules pull in the GPL-licensed
  // @hebcal/core, which must never reach the client bundle (see CLAUDE.md).
  const ALLOWED = new Set([
    '@hebcal/learning/common',
    '@hebcal/learning/dafYomiBase',
    '@hebcal/learning/mishnaYomiBase',
    '@hebcal/learning/nachYomiBase',
    '@hebcal/learning/pirkeiAvotBase',
    '@hebcal/learning/psalmsBase',
    '@hebcal/learning/rambam1Base',
    '@hebcal/learning/yerushalmiBase',
    '@hebcal/learning/he.po',
    '@hebcal/learning/shekalimDafYomiMap.json',
    '@hebcal/learning/yerushalmiVilnaMap.json',
  ]);

  it('imports only core-free @hebcal subpaths across src/', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(entry.name)) {
          for (const match of readFileSync(path, 'utf8').matchAll(/from\s+['"](@hebcal\/[^'"]+)['"]/g)) {
            if (!ALLOWED.has(match[1])) offenders.push(`${path}: ${match[1]}`);
          }
        }
      }
    };
    walk(join(process.cwd(), 'src'));
    expect(offenders).toEqual([]);
  });
});

describe('sanitizeHiddenLearning', () => {
  it('keeps only known cycle keys, deduplicated', () => {
    expect(sanitizeHiddenLearning(['dafYomi', 'dafYomi', 'nope', 42, 'tehillim'])).toEqual(['dafYomi', 'tehillim']);
    expect(sanitizeHiddenLearning('dafYomi')).toEqual([]);
    expect(sanitizeHiddenLearning(undefined)).toEqual([]);
    expect(sanitizeHiddenLearning([...LEARNING_CYCLE_KEYS])).toEqual([...LEARNING_CYCLE_KEYS]);
  });
});

describe('name tables', () => {
  // Enumerate every name each cycle can ever produce and require a real
  // Hebrew and Russian rendering (not the English fallback) — so a library
  // data update can't silently surface an untranslated name.
  function expectCovered(keys: Iterable<string>, source: string) {
    for (const key of keys) {
      expect(LEARNING_NAMES_RU[key], `${source}: missing Russian name for "${key}"`).toBeDefined();
      expect(learningName(key, 'he'), `${source}: missing Hebrew name for "${key}"`).not.toBe(key);
    }
  }

  it('covers every Bavli and Yerushalmi tractate', () => {
    expectCovered(
      shas0.map((d) => d.name),
      'bavli',
    );
    expectCovered(
      vilna.shas.map(([name]) => name),
      'yerushalmi',
    );
  });

  it('covers every Mishna Yomit tractate across a full cycle', () => {
    const index = new MishnaYomiIndex();
    const keys = new Set<string>();
    for (let abs = mishnaYomiStart; keys.size < 63; abs++) {
      for (const m of index.lookup(abs)) keys.add(m.k);
    }
    expect(keys.size).toBe(63);
    expectCovered(keys, 'mishna');
  });

  it('covers every Nach Yomi book across a full 742-day cycle', () => {
    const index = new NachYomiIndex();
    const keys = new Set<string>();
    for (let i = 0; i < 742; i++) keys.add(index.lookup(nachYomiStart + i).k);
    expectCovered(keys, 'nach');
  });

  it('covers every Mishneh Torah section of the Daily Rambam cycle', () => {
    expectCovered(new Set(mishnehTorah1.map((d) => d.name)), 'rambam');
  });
});
