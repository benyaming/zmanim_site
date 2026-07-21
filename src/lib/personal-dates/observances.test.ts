import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { anniversaryInYear, hebrewPartsToDay, partsFromDay } from './anniversaries';
import {
  brisDay,
  civilOfAnchor,
  mitzvahDay,
  nextCivilAnniversary,
  nextHebrewAnniversary,
  observancesOn,
  personalDatesFingerprint,
  shivaDay,
  shloshimDay,
} from './observances';
import type { AnchorDate, HebrewDateParts, Observance, Person, PersonalDatesData, StandaloneDate } from './types';

const d = (year: number, month: number, day: number): HebrewDateParts => ({ year, month, day });
const anchorHeb = (parts: HebrewDateParts, afterSunset?: boolean): AnchorDate => ({ hebrew: parts, afterSunset });
const anchorOn = (iso: string): AnchorDate => ({ hebrew: partsFromDay(DateTime.fromISO(iso)) });

const data = (people: Person[] = [], occasions: StandaloneDate[] = []): PersonalDatesData => ({ people, occasions });
const on = (iso: string, d: PersonalDatesData): Observance[] => observancesOn(DateTime.fromISO(iso), d);
const kinds = (iso: string, d: PersonalDatesData): string[] => on(iso, d).map((o) => o.kind).sort();
const find = (iso: string, d: PersonalDatesData, kind: string): Observance | undefined =>
  on(iso, d).find((o) => o.kind === kind);

describe('observancesOn — show both calendars', () => {
  it('marks the Hebrew birthday and the civil birthday on their respective days', () => {
    const birth = anchorHeb(d(5760, 4, 22)); // 22 Tammuz 5760
    const p: Person = { id: 'p1', name: 'Rivka', events: [{ id: 'e1', kind: 'birth', anchor: birth }] };
    const dataset = data([p]);

    // Civil birthday recurs on the anchor's own Gregorian month/day.
    const civil = civilOfAnchor(birth);
    const civilThisYear = DateTime.fromObject({ year: 2025, month: civil.month, day: civil.day });
    const civilObs = find(civilThisYear.toISODate()!, dataset, 'civilBirthday');
    expect(civilObs?.number).toBe(2025 - civil.year);

    // Hebrew birthday recurs on the Hebrew anniversary day.
    const hebDay = hebrewPartsToDay(anniversaryInYear(d(5760, 4, 22), 5785, 'adar2')!);
    const hebObs = find(hebDay.toISODate()!, dataset, 'hebrewBirthday');
    expect(hebObs?.number).toBe(5785 - 5760);
  });

  it('civil recurrence of a Feb-29 anchor falls on Feb 28 in common years, Feb 29 in leap years', () => {
    const p: Person = { id: 'p1', name: 'Leap', events: [{ id: 'e1', kind: 'birth', anchor: anchorOn('2000-02-29') }] };
    const dataset = data([p]);
    expect(find('2024-02-29', dataset, 'civilBirthday')?.number).toBe(24); // leap
    expect(find('2023-02-28', dataset, 'civilBirthday')?.number).toBe(23); // common → Feb 28
    expect(find('2023-03-01', dataset, 'civilBirthday')).toBeUndefined();
    expect(find('2024-02-28', dataset, 'civilBirthday')).toBeUndefined(); // real Feb 28 only in leap years
  });
});

describe('observancesOn — derived milestones', () => {
  const male = (anchor: AnchorDate, extra: Partial<Person> = {}): PersonalDatesData =>
    data([{ id: 'p1', name: 'Dovid', gender: 'male', events: [{ id: 'e1', kind: 'birth', anchor }], ...extra }]);

  it('bris is the 8th day, boys only, and honours overrides', () => {
    const birth = anchorOn('2020-01-01');
    const bris = brisDay(birth);
    expect(bris.toISODate()).toBe('2020-01-08');
    expect(kinds(bris.toISODate()!, male(birth))).toContain('bris');
    // Girls get no bris.
    const girl = data([{ id: 'p1', name: 'Sarah', gender: 'female', events: [{ id: 'e1', kind: 'birth', anchor: birth }] }]);
    expect(kinds(bris.toISODate()!, girl)).not.toContain('bris');
    // Unset gender derives no milestones.
    const unknown = data([{ id: 'p1', name: '?', events: [{ id: 'e1', kind: 'birth', anchor: birth }] }]);
    expect(on(bris.toISODate()!, unknown)).toEqual([]);
    // Override 'off' hides it.
    const off = male(birth);
    off.people[0].events[0].overrides = { bris: 'off' };
    expect(kinds(bris.toISODate()!, off)).not.toContain('bris');
    // Explicit override moves it.
    const moved = male(birth);
    moved.people[0].events[0].overrides = { bris: anchorOn('2020-02-10') };
    expect(kinds(bris.toISODate()!, moved)).not.toContain('bris');
    expect(kinds('2020-02-10', moved)).toContain('bris');
  });

  it('bar mitzvah is the 13th Hebrew birthday in Adar II; bat mitzvah the 12th', () => {
    // Born 14 Adar 5769 → bar mitzvah 14 Adar II 5782 = 2022-03-17 (pinned in the golden suite).
    const birth = anchorHeb(d(5769, 12, 14));
    expect(mitzvahDay(birth, 'male')?.toISODate()).toBe('2022-03-17');
    expect(kinds('2022-03-17', male(birth))).toContain('barMitzvah');

    const girl = data([{ id: 'p1', name: 'Bat', gender: 'female', events: [{ id: 'e1', kind: 'birth', anchor: birth }] }]);
    const batDay = mitzvahDay(birth, 'female')!;
    expect(find(batDay.toISODate()!, girl, 'batMitzvah')?.number).toBe(12);
  });
});

describe('observancesOn — death: yahrzeit, civil anniversary, shiva, shloshim', () => {
  const death = anchorHeb(d(5787, 8, 30)); // 30 Cheshvan 5787
  const person: Person = { id: 'p1', name: 'Zayde', events: [{ id: 'e1', kind: 'death', anchor: death }] };
  const dataset = data([person]);

  it('marks the passing day itself (year 0) on both calendars', () => {
    const dayHeb = hebrewPartsToDay(death.hebrew);
    expect(find(dayHeb.toISODate()!, dataset, 'yahrzeit')?.number).toBe(0);
    const dayCivil = civilOfAnchor(death);
    expect(find(dayCivil.toISODate()!, dataset, 'civilDeathAnniversary')?.number).toBe(0);
  });

  it('yahrzeit recurs each year after death (30 Cheshvan 5788 = 2027-11-30)', () => {
    expect(find('2027-11-30', dataset, 'yahrzeit')?.number).toBe(1);
  });

  it('civil anniversary of the passing recurs from the year after', () => {
    const civil = civilOfAnchor(death);
    const first = DateTime.fromObject({ year: civil.year + 1, month: civil.month, day: civil.day });
    expect(find(first.toISODate()!, dataset, 'civilDeathAnniversary')?.number).toBe(1);
  });

  it('shiva ends on the 7th day and shloshim on the 30th, counted from burial', () => {
    // Burial day is day 1: shiva = +6, shloshim = +29 (Chabad/myzmanim convention).
    const buried = hebrewPartsToDay(death.hebrew);
    expect(shivaDay(death).diff(buried, 'days').days).toBe(6);
    expect(shloshimDay(death).diff(buried, 'days').days).toBe(29);
    expect(kinds(shivaDay(death).toISODate()!, dataset)).toContain('shiva');
    expect(kinds(shloshimDay(death).toISODate()!, dataset)).toContain('shloshim');
  });

  it('a separate burial date drives shiva/shloshim, while the death date drives the yahrzeit', () => {
    const withBurial: Person = {
      id: 'p2',
      name: 'Bubbe',
      events: [{ id: 'e1', kind: 'death', anchor: death, burial: anchorOn('2026-11-25') }],
    };
    const ds = data([withBurial]);
    expect(kinds('2026-12-01', ds)).toContain('shiva'); // 2026-11-25 + 6
    expect(kinds('2026-12-24', ds)).toContain('shloshim'); // 2026-11-25 + 29
  });
});

describe('observancesOn — standalone occasions', () => {
  it('a wedding marks both its Hebrew and civil anniversary', () => {
    const anchor = anchorOn('2010-06-20');
    const occ: StandaloneDate = { id: 'o1', kind: 'wedding', label: 'Our wedding', anchor };
    const dataset = data([], [occ]);
    const civil = civilOfAnchor(anchor);
    const civilNext = DateTime.fromObject({ year: 2026, month: civil.month, day: civil.day });
    expect(find(civilNext.toISODate()!, dataset, 'civilAnniversary')?.number).toBe(2026 - civil.year);
    const hebNext = hebrewPartsToDay(anniversaryInYear(anchor.hebrew, anchor.hebrew.year + 16, 'adar2')!);
    expect(kinds(hebNext.toISODate()!, dataset)).toContain('hebrewAnniversary');
  });

  it('returns nothing for an empty dataset', () => {
    expect(observancesOn(DateTime.fromISO('2025-01-01'), data())).toEqual([]);
  });
});

describe('observancesOn — a passing ends birthdays and future milestones', () => {
  const born = anchorOn('2000-01-01');

  it('drops birthdays that fall after the death, keeps earlier ones', () => {
    const ds = data([
      {
        id: 'p',
        name: 'X',
        events: [
          { id: 'e1', kind: 'birth', anchor: born },
          { id: 'e2', kind: 'death', anchor: anchorOn('2020-06-15') },
        ],
      },
    ]);
    expect(kinds('2019-01-01', ds)).toContain('civilBirthday'); // while living
    expect(kinds('2021-01-01', ds)).not.toContain('civilBirthday'); // after the passing
    expect(kinds('2021-01-01', ds)).not.toContain('hebrewBirthday');
  });

  it('drops a milestone that would fall after the death', () => {
    const ds = data([
      {
        id: 'p',
        name: 'X',
        gender: 'male',
        events: [
          { id: 'e1', kind: 'birth', anchor: born },
          { id: 'e2', kind: 'death', anchor: anchorOn('2005-01-01') },
        ],
      },
    ]);
    const bar = mitzvahDay(born, 'male')!; // ~2013, after the 2005 death
    expect(kinds(bar.toISODate()!, ds)).not.toContain('barMitzvah');
  });
});

describe('nextHebrewAnniversary / nextCivilAnniversary', () => {
  it('rolls to the coming occurrence', () => {
    const death = anchorHeb(d(5787, 8, 30));
    // First yahrzeit is 2027-11-30; on that day it returns itself, after it rolls forward.
    expect(nextHebrewAnniversary(death, DateTime.fromISO('2027-11-30'), 'from1')?.toISODate()).toBe('2027-11-30');
    expect(nextHebrewAnniversary(death, DateTime.fromISO('2027-12-01'), 'from1')?.toISODate()).toBe('2028-11-19');

    const birth = anchorOn('1990-05-15');
    expect(nextCivilAnniversary(birth, DateTime.fromISO('2025-01-01'), 0)?.toISODate()).toBe('2025-05-15');
    expect(nextCivilAnniversary(birth, DateTime.fromISO('2025-06-01'), 0)?.toISODate()).toBe('2026-05-15');
  });
});

describe('personalDatesFingerprint', () => {
  const base = (): PersonalDatesData =>
    data([{ id: 'p1', name: 'Rivka', gender: 'female', events: [{ id: 'e1', kind: 'birth', anchor: anchorHeb(d(5760, 4, 22)) }] }]);

  it('is stable for equal data and changes when a rendered field changes', () => {
    expect(personalDatesFingerprint(base())).toBe(personalDatesFingerprint(base()));

    const renamed = base();
    renamed.people[0].name = 'Leah';
    expect(personalDatesFingerprint(renamed)).not.toBe(personalDatesFingerprint(base()));

    const regendered = base();
    regendered.people[0].gender = 'male';
    expect(personalDatesFingerprint(regendered)).not.toBe(personalDatesFingerprint(base()));

    const withOccasion = base();
    withOccasion.occasions = [{ id: 'o1', kind: 'wedding', label: 'W', anchor: anchorHeb(d(5760, 4, 22)) }];
    expect(personalDatesFingerprint(withOccasion)).not.toBe(personalDatesFingerprint(base()));

    const overridden = base();
    overridden.people[0].events[0].overrides = { batMitzvah: 'off' };
    expect(personalDatesFingerprint(overridden)).not.toBe(personalDatesFingerprint(base()));
  });
});
