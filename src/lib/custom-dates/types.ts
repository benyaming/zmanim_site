/**
 * Personal recurring Hebrew-calendar dates: birthdays, bar/bat mitzvahs and
 * yahrzeits. The anchor (birth / death) is stored as a canonical Hebrew date —
 * the Gregorian date shown while editing is always derived from it, so the two
 * can never disagree.
 */

export type CustomDateKind = 'birthday' | 'barMitzvah' | 'batMitzvah' | 'yahrzeit';

/** Which Adar observes an anniversary whose anchor is Adar of a non-leap year. */
export type AdarBehavior = 'adar1' | 'adar2';

/** A Hebrew calendar date. Months are 1=Nisan … 12=Adar / Adar I, 13=Adar II. */
export interface HebrewDateParts {
  year: number;
  month: number;
  day: number;
}

export interface CustomDate {
  id: string;
  kind: CustomDateKind;
  /** The person's name; may be empty — display falls back to the kind name. */
  label: string;
  /** Canonical anchor date (birth / death) — the only stored date. */
  hebrew: HebrewDateParts;
  /**
   * The Gregorian entry had "after sunset" checked. The anchor already
   * accounts for it; kept only so editing round-trips to the entered date.
   */
  afterSunset?: boolean;
  /**
   * Leap-year Adar choice when the anchor is Adar of a non-leap year.
   * Absent = kind default: yahrzeit → Adar I (Ashkenazi), birthday → Adar II.
   * Ignored for bar/bat mitzvah, which is always Adar II per halacha.
   */
  adarBehavior?: AdarBehavior;
}

/** One entry's observance in a specific Hebrew year. */
export interface CustomDateOccurrence {
  entry: CustomDate;
  /** The observed date in the target year (may differ from the anchor's month/day). */
  hebrew: HebrewDateParts;
  /** Birthday: age turned (0 on the birth date itself); yahrzeit: nth; bar/bat mitzvah: 13/12. */
  number: number;
}

export const MAX_CUSTOM_DATES = 50;
