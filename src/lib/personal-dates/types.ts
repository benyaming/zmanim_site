/**
 * Personal dates, modelled around **people**: a person owns a set of anchor
 * dates (birth, death, wedding, custom), and the observances that flow from
 * them — Hebrew + civil birthday, bris, bar/bat mitzvah, yahrzeit, shiva,
 * shloshim — are *derived*, never entered. Standalone "regular dates" (a
 * wedding day, an anniversary) that aren't tied to one person are supported
 * too. Every anchor is stored as a canonical Hebrew date; its civil date is
 * always derived, so the two can never disagree.
 */

export type Gender = 'male' | 'female';

/** Which Adar observes a Hebrew anniversary whose anchor is Adar of a non-leap year. */
export type AdarBehavior = 'adar1' | 'adar2';

/** A Hebrew calendar date. Months are 1=Nisan … 12=Adar / Adar I, 13=Adar II. */
export interface HebrewDateParts {
  year: number;
  month: number;
  day: number;
}

/**
 * A canonical anchor date. The Hebrew parts are the only stored form; the civil
 * date shown while editing is always derived. `afterSunset` records that the
 * civil date entered was after nightfall — the anchor already accounts for it,
 * so it is kept only to round-trip editing back to the entered civil day.
 */
export interface AnchorDate {
  hebrew: HebrewDateParts;
  afterSunset?: boolean;
  /**
   * Leap-year Adar choice for the Hebrew recurrence when the anchor is Adar of
   * a non-leap year. Absent = the event's kind default (death/yahrzeit → Adar I
   * per Ashkenazi custom, everything else → Adar II).
   */
  adarBehavior?: AdarBehavior;
}

export type PersonEventKind = 'birth' | 'death' | 'wedding' | 'custom';

/** The derived observances a user can hide or re-date on a birth event. */
export type MilestoneKey = 'bris' | 'barMitzvah' | 'batMitzvah';

export interface PersonEvent {
  id: string;
  kind: PersonEventKind;
  anchor: AnchorDate;
  /** death only — burial/funeral date driving shiva & shloshim (absent = same as anchor). */
  burial?: AnchorDate;
  /** custom only — the event's own name. */
  label?: string;
  /**
   * Overrides for the birth event's derived milestones: `'off'` hides one, an
   * `AnchorDate` replaces its computed date (e.g. a medically delayed bris).
   */
  overrides?: Partial<Record<MilestoneKey, 'off' | AnchorDate>>;
}

export interface Person {
  id: string;
  name: string;
  gender?: Gender;
  events: PersonEvent[];
}

/** A "regular date" not tied to a person: a wedding day, an anniversary, custom. */
export interface StandaloneDate {
  id: string;
  kind: 'wedding' | 'anniversary' | 'custom';
  label: string;
  anchor: AnchorDate;
}

/** The whole persisted tool state. */
export interface PersonalDatesData {
  people: Person[];
  occasions: StandaloneDate[];
}

export const EMPTY_PERSONAL_DATES: PersonalDatesData = { people: [], occasions: [] };

export type ObservanceKind =
  | 'hebrewBirthday'
  | 'civilBirthday'
  | 'bris'
  | 'barMitzvah'
  | 'batMitzvah'
  | 'yahrzeit'
  | 'civilDeathAnniversary'
  | 'shiva'
  | 'shloshim'
  | 'hebrewAnniversary'
  | 'civilAnniversary';

/** One observance falling on a specific Gregorian day. */
export interface Observance {
  /** The owning person or occasion id — for chip keys and the calendar day-cache. */
  sourceId: string;
  /** The person / occasion name (may be empty; callers fall back to a kind label). */
  label: string;
  kind: ObservanceKind;
  calendar: 'hebrew' | 'gregorian';
  /** Age turned / nth anniversary (0 = the day itself); null for one-time milestones. */
  number: number | null;
}

export const MAX_PEOPLE = 50;
export const MAX_EVENTS_PER_PERSON = 12;
export const MAX_OCCASIONS = 50;

/** Event kinds a person can have at most one of — you're born once and pass once. */
export const SINGLE_EVENT_KINDS: readonly PersonEventKind[] = ['birth', 'death'];
