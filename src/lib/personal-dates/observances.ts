import { JewishDate } from 'kosher-zmanim';
import { DateTime } from 'luxon';

import { anniversaryInYear, hebrewPartsToDay, partsFromDay, yahrzeitInYear } from './anniversaries';
import type {
  AdarBehavior,
  AnchorDate,
  Gender,
  HebrewDateParts,
  MilestoneKey,
  Observance,
  Person,
  PersonalDatesData,
  PersonEvent,
  StandaloneDate,
} from './types';

/**
 * The unified observance engine. Everything a person's anchor dates imply —
 * Hebrew + civil birthday, bris, bar/bat mitzvah, yahrzeit, civil death
 * anniversary, shiva, shloshim — and every standalone occasion, resolved on a
 * given Gregorian day. Every anchor recurs on BOTH calendars each year: the
 * Hebrew anniversary via the "Calendrical Calculations" arithmetic in
 * `anniversaries.ts`, the civil anniversary on the anchor's own Gregorian
 * month/day.
 */

/** The Adar choice for a Hebrew recurrence: explicit, else the style default. */
function adarFor(anchor: AnchorDate, style: 'anniversary' | 'yahrzeit'): AdarBehavior {
  return anchor.adarBehavior ?? (style === 'yahrzeit' ? 'adar1' : 'adar2');
}

/** The civil day (app-Luxon, local midnight) an anchor was actually entered on. */
export function civilOfAnchor(anchor: AnchorDate): DateTime {
  return hebrewPartsToDay(anchor.hebrew).minus({ days: anchor.afterSunset ? 1 : 0 });
}

/** The bris (8th day): the birth day is day 1, so 7 days after the Hebrew birth date. */
export function brisDay(birth: AnchorDate): DateTime {
  return hebrewPartsToDay(birth.hebrew).plus({ days: 7 });
}

/** The bar (13) / bat (12) mitzvah day, always Adar II per halacha, or null out of range. */
export function mitzvahDay(birth: AnchorDate, gender: Gender | undefined): DateTime | null {
  const parts = mitzvahParts(birth.hebrew, gender);
  return parts ? hebrewPartsToDay(parts) : null;
}

function mitzvahParts(birth: HebrewDateParts, gender: Gender | undefined): HebrewDateParts | null {
  return anniversaryInYear(birth, birth.year + (gender === 'female' ? 12 : 13), 'adar2');
}

/** Shiva ends on the 7th day (burial day is day 1, so +6 from the Hebrew burial date). */
export function shivaDay(burial: AnchorDate): DateTime {
  return hebrewPartsToDay(burial.hebrew).plus({ days: 6 });
}

/** Shloshim ends on the 30th day (+29 from the Hebrew burial date). */
export function shloshimDay(burial: AnchorDate): DateTime {
  return hebrewPartsToDay(burial.hebrew).plus({ days: 29 });
}

const isGregorianLeapYear = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Whether target Hebrew parts (year included) equal the given day's Hebrew parts. */
function matchesHebrew(parts: HebrewDateParts | null, hyear: number, hmonth: number, hday: number): boolean {
  return !!parts && parts.year === hyear && parts.month === hmonth && parts.day === hday;
}

/**
 * The nth civil anniversary if `date` is the recurrence of `civilAnchor`, else
 * null. A Feb-29 anchor is observed on Feb 28 in common years. `startOffset`
 * skips the anchor year itself for death anniversaries (1) but not births (0).
 */
function civilNumberOn(civilAnchor: DateTime, date: DateTime, startOffset: 0 | 1): number | null {
  const month = civilAnchor.month;
  let day = civilAnchor.day;
  if (month === 2 && day === 29 && !isGregorianLeapYear(date.year)) day = 28;
  if (date.month !== month || date.day !== day) return null;
  const number = date.year - civilAnchor.year;
  return number < startOffset ? null : number;
}

/** The effective Hebrew parts of an overridable milestone, or null if hidden. */
function milestoneParts(
  override: 'off' | AnchorDate | undefined,
  fallback: () => HebrewDateParts | null,
): HebrewDateParts | null {
  if (override === 'off') return null;
  if (override) return override.hebrew;
  return fallback();
}

type Push = (kind: Observance['kind'], calendar: Observance['calendar'], number: number | null) => void;

function birthObservances(
  person: Person,
  ev: PersonEvent,
  date: DateTime,
  hyear: number,
  hmonth: number,
  hday: number,
  deathDay: DateTime | null,
  push: Push,
): void {
  // Once someone has passed, their birthday (and any milestone) no longer occurs.
  if (deathDay && date > deathDay) return;
  const { anchor } = ev;
  const hebrew = anniversaryInYear(anchor.hebrew, hyear, adarFor(anchor, 'anniversary'));
  if (matchesHebrew(hebrew, hyear, hmonth, hday)) push('hebrewBirthday', 'hebrew', hyear - anchor.hebrew.year);
  const civil = civilNumberOn(civilOfAnchor(anchor), date, 0);
  if (civil !== null) push('civilBirthday', 'gregorian', civil);

  // Milestones derive from birth + gender: bris & bar mitzvah for boys, bat
  // mitzvah for girls; an unset gender derives none. Each is overridable.
  const gender = person.gender;
  if (gender === 'male') {
    const bris = milestoneParts(ev.overrides?.bris, () => partsFromDay(brisDay(anchor)));
    if (matchesHebrew(bris, hyear, hmonth, hday)) push('bris', 'hebrew', null);
    const bar = milestoneParts(ev.overrides?.barMitzvah, () => mitzvahParts(anchor.hebrew, 'male'));
    if (matchesHebrew(bar, hyear, hmonth, hday)) push('barMitzvah', 'hebrew', 13);
  } else if (gender === 'female') {
    const bat = milestoneParts(ev.overrides?.batMitzvah, () => mitzvahParts(anchor.hebrew, 'female'));
    if (matchesHebrew(bat, hyear, hmonth, hday)) push('batMitzvah', 'hebrew', 12);
  }
}

function deathObservances(
  ev: PersonEvent,
  date: DateTime,
  hyear: number,
  hmonth: number,
  hday: number,
  push: Push,
): void {
  const { anchor } = ev;
  // The passing itself (year 0 = the anchor day) plus every later yahrzeit.
  const yahrzeit =
    hyear < anchor.hebrew.year
      ? null
      : hyear === anchor.hebrew.year
        ? anchor.hebrew
        : yahrzeitInYear(anchor.hebrew, hyear, adarFor(anchor, 'yahrzeit'));
  if (matchesHebrew(yahrzeit, hyear, hmonth, hday)) push('yahrzeit', 'hebrew', hyear - anchor.hebrew.year);
  // The civil anniversary of the passing, including the day itself (year 0).
  const civil = civilNumberOn(civilOfAnchor(anchor), date, 0);
  if (civil !== null) push('civilDeathAnniversary', 'gregorian', civil);
  // Shiva & shloshim count from burial (defaults to the death date).
  const burial = ev.burial ?? anchor;
  if (matchesHebrew(partsFromDay(shivaDay(burial)), hyear, hmonth, hday)) push('shiva', 'hebrew', null);
  if (matchesHebrew(partsFromDay(shloshimDay(burial)), hyear, hmonth, hday)) push('shloshim', 'hebrew', null);
}

function anniversaryObservances(
  anchor: AnchorDate,
  date: DateTime,
  hyear: number,
  hmonth: number,
  hday: number,
  push: Push,
): void {
  const hebrew = anniversaryInYear(anchor.hebrew, hyear, adarFor(anchor, 'anniversary'));
  if (matchesHebrew(hebrew, hyear, hmonth, hday)) push('hebrewAnniversary', 'hebrew', hyear - anchor.hebrew.year);
  const civil = civilNumberOn(civilOfAnchor(anchor), date, 0);
  if (civil !== null) push('civilAnniversary', 'gregorian', civil);
}

function personObservancesOn(person: Person, date: DateTime, hyear: number, hmonth: number, hday: number, out: Observance[]): void {
  const push: Push = (kind, calendar, number) => out.push({ sourceId: person.id, label: person.name, kind, calendar, number });
  // The earliest death gates the person's birthdays and milestones.
  let deathDay: DateTime | null = null;
  for (const ev of person.events) {
    if (ev.kind !== 'death') continue;
    const day = civilOfAnchor(ev.anchor);
    if (!deathDay || day < deathDay) deathDay = day;
  }
  for (const ev of person.events) {
    if (ev.kind === 'birth') birthObservances(person, ev, date, hyear, hmonth, hday, deathDay, push);
    else if (ev.kind === 'death') deathObservances(ev, date, hyear, hmonth, hday, push);
    else anniversaryObservances(ev.anchor, date, hyear, hmonth, hday, push); // wedding / custom
  }
}

function occasionObservancesOn(occasion: StandaloneDate, date: DateTime, hyear: number, hmonth: number, hday: number, out: Observance[]): void {
  const push: Push = (kind, calendar, number) => out.push({ sourceId: occasion.id, label: occasion.label, kind, calendar, number });
  anniversaryObservances(occasion.anchor, date, hyear, hmonth, hday, push);
}

/** Every observance falling on the given Gregorian day. */
export function observancesOn(date: DateTime, data: PersonalDatesData): Observance[] {
  if (data.people.length === 0 && data.occasions.length === 0) return [];
  const jd = new JewishDate(date);
  const hyear = jd.getJewishYear();
  const hmonth = jd.getJewishMonth();
  const hday = jd.getJewishDayOfMonth();
  const out: Observance[] = [];
  for (const person of data.people) personObservancesOn(person, date, hyear, hmonth, hday, out);
  for (const occasion of data.occasions) occasionObservancesOn(occasion, date, hyear, hmonth, hday, out);
  return out;
}

/** The next Hebrew anniversary on or after `today` ('from1' skips the anchor year for yahrzeits). */
export function nextHebrewAnniversary(anchor: AnchorDate, today: DateTime, style: 'from0' | 'from1'): DateTime | null {
  const start = today.startOf('day');
  const adar = adarFor(anchor, style === 'from1' ? 'yahrzeit' : 'anniversary');
  const currentYear = new JewishDate(start).getJewishYear();
  const firstYear = anchor.hebrew.year + (style === 'from1' ? 1 : 0);
  const from = Math.max(currentYear, firstYear);
  for (let hy = from; hy <= from + 1; hy++) {
    const parts = style === 'from1' ? yahrzeitInYear(anchor.hebrew, hy, adar) : anniversaryInYear(anchor.hebrew, hy, adar);
    if (!parts) continue;
    const day = hebrewPartsToDay(parts);
    if (day >= start) return day;
  }
  return null;
}

/** The next civil anniversary on or after `today` (`startOffset` = 1 skips the anchor year). */
export function nextCivilAnniversary(anchor: AnchorDate, today: DateTime, startOffset: 0 | 1): DateTime | null {
  const start = today.startOf('day');
  const civil = civilOfAnchor(anchor);
  for (let y = start.year; y <= start.year + 1; y++) {
    if (y - civil.year < startOffset) continue;
    const day = civil.month === 2 && civil.day === 29 && !isGregorianLeapYear(y) ? 28 : civil.day;
    const cand = DateTime.fromObject({ year: y, month: civil.month, day }).startOf('day');
    if (cand.isValid && cand >= start) return cand;
  }
  return null;
}

function anchorFingerprint(a: AnchorDate): unknown {
  return [a.hebrew.year, a.hebrew.month, a.hebrew.day, a.afterSunset ? 1 : 0, a.adarBehavior ?? ''];
}

const MILESTONE_KEYS: readonly MilestoneKey[] = ['bris', 'barMitzvah', 'batMitzvah'];

function overridesFingerprint(ov: PersonEvent['overrides']): unknown {
  if (!ov) return 0;
  return MILESTONE_KEYS.map((k) => {
    const v = ov[k];
    return v === undefined ? '' : v === 'off' ? 'off' : anchorFingerprint(v);
  });
}

/**
 * A stable serialization of everything that affects rendering, used as the
 * calendar grid's day-cache identity (the object's identity is not). Every
 * rendered field must appear here, or cells stale when data changes.
 */
export function personalDatesFingerprint(data: PersonalDatesData): string {
  return JSON.stringify({
    p: data.people.map((p) => [
      p.id,
      p.name,
      p.gender ?? '',
      p.events.map((e) => [e.kind, anchorFingerprint(e.anchor), e.burial ? anchorFingerprint(e.burial) : '', e.label ?? '', overridesFingerprint(e.overrides)]),
    ]),
    o: data.occasions.map((o) => [o.id, o.kind, o.label, anchorFingerprint(o.anchor)]),
  });
}
