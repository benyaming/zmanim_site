import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import en from '@/../messages/en.json';
import he from '@/../messages/he.json';
import ru from '@/../messages/ru.json';

import { computeZmanim } from './calculator';
import { ZMANIM } from './definitions';

/**
 * The per-opinion descriptions — the halachic detail behind every info popover.
 *
 * CLAUDE.md treats these as safety-critical: a description may not change
 * without a test pinning its expected behaviour. Asserting the prose verbatim
 * would pin nothing (it would fail on any legitimate rewording while still
 * passing on a wrong angle), so these pin the CLAIMS the prose makes instead:
 *
 *  - a degree opinion states its own angle, the one its label carries;
 *  - a fixed-minute opinion states its own minute count;
 *  - any "≈ N minutes" figure agrees with what the engine actually computes at
 *    the Jerusalem equinox the figure is anchored to;
 *  - and that figure never appears without the qualifier saying so.
 *
 * The failure this catches is a description drifting away from the key it
 * documents — a copied entry left with the neighbouring angle, a rewritten
 * paragraph that keeps a stale minute count, or an anchor quietly diverging
 * from the calculator.
 */
const CATALOGS = { en, he, ru } as const;
type Loc = keyof typeof CATALOGS;
const LOCALES = Object.keys(CATALOGS) as Loc[];

const catalog = (loc: Loc) =>
  CATALOGS[loc].zmanim as unknown as { descriptions: Record<string, string>; shitot: Record<string, string> };

/** Depression angles stated in a string: "16.1°" / "16,1°" → 16.1. */
const anglesIn = (s: string): number[] =>
  [...s.matchAll(/(\d+(?:[.,]\d+)?)\s*°/g)].map((m) => Number(m[1].replace(',', '.')));

/** Minute counts stated in a string, in any of the three languages. */
const minutesIn = (s: string): number[] =>
  [...s.matchAll(/(\d+)[\s -]*(?:мин|minute|min\b|דק)/gi)].map((m) => Number(m[1]));

/** Wording that anchors a minute figure to Jerusalem at the equinox. */
const ANCHOR_WORDS: Record<Loc, RegExp> = {
  ru: /Иерусалим/i,
  en: /Jerusalem/i,
  he: /ירושלים/,
};
const EQUINOX_WORDS: Record<Loc, RegExp> = {
  ru: /равноденств/i,
  en: /equinox/i,
  he: /שוויון/,
};

/**
 * The anchor the minute figures are quoted against.
 *
 * Deliberately the SAME Jerusalem equinox the golden fixtures use
 * (`calculator.golden.test.ts`, `calculator.elevation.test.ts`) — coordinates
 * and date included. docs/zmanim.md requires the description figures to match
 * those fixtures, so checking them against any other point would verify a
 * different claim; and that anchor is the one cross-validated to the second
 * against Hebcal, where an arbitrary city-centre coordinate is validated
 * against nothing. Keep the three in step: a second "Jerusalem equinox" in the
 * suite is a second thing to drift.
 */
const EQUINOX = computeZmanim({
  lat: 31.778,
  lng: 35.2354,
  date: DateTime.fromObject({ year: 2024, month: 3, day: 20, hour: 12 }, { zone: 'Asia/Jerusalem' }),
  timeZoneId: 'Asia/Jerusalem',
});
const at = (key: string) => EQUINOX.find((z) => z.key === key)?.time ?? null;
const SUNRISE = at('sunrise')!;
const SUNSET = at('sunset')!;

/** Minutes from the anchor: before sunrise for a dawn, after sunset for a nightfall. */
function equinoxOffsetMinutes(key: string): number | null {
  const time = at(key);
  if (!time) return null;
  const beforeSunrise = SUNRISE.diff(time).as('minutes');
  return beforeSunrise > 0 ? beforeSunrise : time.diff(SUNSET).as('minutes');
}

const DEGREE_ZMANIM = ZMANIM.filter((z) => z.family === 'degrees');
const FIXED_ZMANIM = ZMANIM.filter((z) => z.family === 'fixedMinutes' && z.key !== 'candleLighting');

describe('zman descriptions', () => {
  it.each(LOCALES)('%s describes every zman', (loc) => {
    const { descriptions } = catalog(loc);
    for (const def of ZMANIM) {
      expect(descriptions[def.key], `${loc}: descriptions.${def.key}`).toBeTypeOf('string');
      expect(descriptions[def.key]!.trim(), `${loc}: descriptions.${def.key}`).not.toBe('');
    }
  });

  /**
   * A degree opinion IS its angle, so the description must name it — and name
   * the same one as the label. A description carrying only a neighbouring
   * opinion's angle is the copy/paste failure this catches.
   */
  it.each(LOCALES)('%s states each degree opinion’s own angle', (loc) => {
    const { descriptions, shitot } = catalog(loc);
    for (const def of DEGREE_ZMANIM) {
      const labelAngles = anglesIn(shitot[def.key]!);
      expect(labelAngles, `${loc}: shitot.${def.key} must state exactly one angle`).toHaveLength(1);
      expect(anglesIn(descriptions[def.key]!), `${loc}: descriptions.${def.key}`).toContain(labelAngles[0]);
    }
  });

  it.each(LOCALES)('%s states each fixed-minute opinion’s own minute count', (loc) => {
    const { descriptions, shitot } = catalog(loc);
    for (const def of FIXED_ZMANIM) {
      const labelMinutes = minutesIn(shitot[def.key]!);
      expect(labelMinutes.length, `${loc}: shitot.${def.key} must state a minute count`).toBeGreaterThan(0);
      expect(minutesIn(descriptions[def.key]!), `${loc}: descriptions.${def.key}`).toContain(labelMinutes[0]);
    }
  });

  /**
   * The "≈ N minutes" figures are the Jerusalem-equinox anchor from which each
   * angle was derived, so the engine has to agree with them. Tolerance is one
   * minute: the prose rounds, and two anchors genuinely land on a half
   * (6.45° at 26.5 min, 7.083° at 29.5).
   */
  it.each(LOCALES)('%s quotes equinox minute figures the engine agrees with', (loc) => {
    const { descriptions } = catalog(loc);
    let checked = 0;
    for (const def of DEGREE_ZMANIM) {
      const stated = minutesIn(descriptions[def.key]!);
      if (stated.length === 0) continue; // not every locale quotes a figure
      const actual = equinoxOffsetMinutes(def.key);
      expect(actual, `${loc}: ${def.key} has no equinox time to check against`).not.toBeNull();
      const closest = stated.reduce((a, b) => (Math.abs(b - actual!) < Math.abs(a - actual!) ? b : a));
      expect(
        Math.abs(closest - actual!),
        `${loc}: descriptions.${def.key} says ${stated.join('/')} min, engine says ${actual!.toFixed(1)}`,
      ).toBeLessThanOrEqual(1);
      checked++;
    }
    // Guard the guard: if the phrasing changes so nothing parses, this test
    // would silently assert nothing.
    expect(checked, `${loc}: no equinox figures parsed — has the phrasing changed?`).toBeGreaterThanOrEqual(10);
  });

  /**
   * CLAUDE.md rule 7: a minute figure on a degree zman is location- and
   * season-dependent, so it may never be stated bare — in ANY construction.
   *
   * This covers naming an opinion's provenance too, not only "≈ N min"
   * measurements. en/he used to say "the degree form of his 72-minute
   * nightfall" for alos198, alosHashachar and tzais161, which reads as an
   * identity and invites exactly the conclusion the labels were rewritten to
   * prevent — that 16.1° simply IS 72 minutes. All three locales now state the
   * relation as an anchored figure with the caveat.
   */
  it.each(LOCALES)('%s never quotes a minute figure without the equinox qualifier', (loc) => {
    const { descriptions } = catalog(loc);
    let checked = 0;
    for (const def of DEGREE_ZMANIM) {
      const desc = descriptions[def.key]!;
      if (minutesIn(desc).length === 0) continue;
      expect(ANCHOR_WORDS[loc].test(desc), `${loc}: descriptions.${def.key} omits Jerusalem`).toBe(true);
      expect(EQUINOX_WORDS[loc].test(desc), `${loc}: descriptions.${def.key} omits the equinox`).toBe(true);
      checked++;
    }
    expect(checked, `${loc}: no minute figures parsed — has the phrasing changed?`).toBeGreaterThanOrEqual(10);
  });
});
