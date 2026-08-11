import type { ReactNode } from 'react';

import { formatDuration, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ZmanBaseGroup, ZmanFamilyGroup, ZmanGroup, ZmanRow } from '@/lib/zmanim';

import { InfoHint } from './info-hint';
import { SectionHeading } from './section-heading';

/**
 * A blank moment (not a duration) — the sun never reached the angle behind this
 * opinion today, directly or via the dawn/nightfall that bounds a day-fraction.
 * On a NON-polar day these are the short-night blanks worth explaining; on a
 * polar day everything is null and the caller suppresses the caption entirely.
 */
const isBlankMoment = (row: ZmanRow): boolean => row.time === null && row.durationMillis === undefined;

/**
 * The short-night explanation, appended to the info popover of the thing it
 * explains — the family heading in a grouped base, the zman name otherwise.
 *
 * It used to render as visible inline text on the theory that a dash a user
 * can't explain reads as broken data. In a panel where several opinions go
 * blank at once that repeated the same paragraph two or three times down the
 * list and buried the times it was meant to clarify, so it now lives behind the
 * info icon that already sits beside the affected heading. Still composed once
 * per affected base/family, never per row.
 */
const withBlankNote = (detail: string, note: string): string => (detail ? `${detail}\n\n${note}` : note);

function Time({ time, durationMillis, locale }: Pick<ZmanRow, 'time' | 'durationMillis'> & { locale: string }) {
  // Duration zmanim (shaah zmanis) carry a length, not a moment — render h:mm:ss.
  const text = durationMillis !== undefined ? formatDuration(durationMillis) : formatTime(time, locale);
  return (
    <time className={cn('font-mono text-sm tabular-nums shrink-0', text === '—' && 'text-muted-foreground')}>
      {text}
    </time>
  );
}

/** Zman name with its description tucked behind an info popover (tap/click). */
function ZmanName({ name, description }: { name: string; description?: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-sm font-medium">{name}</span>
      {description && <InfoHint detail={description} label={name} />}
    </span>
  );
}

function BaseItem({
  item,
  locale,
  noDegreeTimeNote,
}: {
  item: ZmanBaseGroup;
  locale: string;
  noDegreeTimeNote: string;
}) {
  // The note explains any short-night blank in this base. Gated on the note
  // being present (the caller passes '' on a polar day, where it wouldn't hold).
  const showBlankNote = Boolean(noDegreeTimeNote) && item.rows.some(isBlankMoment);

  // Single opinion → flat row, with the shita inline next to the name (an
  // indented one-row block would waste a line). flex-wrap drops the shita
  // under the name when the row is too narrow to fit everything. This is the
  // everyday-default case, so a blank here (e.g. the 16.1° Alot at Düsseldorf)
  // must still explain itself — a caption under the row.
  if (item.rows.length === 1) {
    const row = item.rows[0];
    return (
      <li>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5">
            <ZmanName
              name={item.name}
              description={showBlankNote ? withBlankNote(item.description, noDegreeTimeNote) : item.description}
            />
            {row.shita && <span className="text-muted-foreground text-xs">{row.shita}</span>}
          </div>
          <Time time={row.time} durationMillis={row.durationMillis} locale={locale} />
        </div>
      </li>
    );
  }

  // Several opinions → name (with its description behind an info popover), then a
  // compact row per shita. The opinion-specific detail hides behind its own info
  // icon so nothing clutters the list, but every explanation stays one tap away.
  //
  // Opinions of one zman are sub-grouped by calculation family only where that
  // split earns its headings — Alot and Tzeit (angle / fixed / seasonal) and
  // Sof zman Shma & Tfila (dawn-to-nightfall vs sunrise-to-sunset day). The
  // decision lives in buildZmanimGroups (`grouped`); everywhere else the list
  // stays flat, so the everyday one-shita-per-zman default never sees a heading.
  const grouped = item.grouped;
  // Flat path: the base's own popover explains all its blanks. In the grouped
  // path each family carries the note instead (below).
  const description =
    !grouped && showBlankNote ? withBlankNote(item.description, noDegreeTimeNote) : item.description;
  return (
    <li>
      <ZmanName name={item.name} description={description} />
      <div className="mt-1 space-y-1 ps-3">
        {grouped
          ? item.families.map((fam) => (
              <FamilyBlock key={fam.family} fam={fam} locale={locale} noDegreeTimeNote={noDegreeTimeNote} />
            ))
          : item.rows.map((row) => <ShitaRow key={row.key} row={row} locale={locale} />)}
      </div>
    </li>
  );
}

/** One shita line: its label (with detail behind info) and its time. */
function ShitaRow({ row, locale }: { row: ZmanRow; locale: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        {row.shita}
        {row.detail && <InfoHint detail={row.detail} label={row.shita} />}
      </span>
      <Time time={row.time} durationMillis={row.durationMillis} locale={locale} />
    </div>
  );
}

/**
 * One calculation family under a multi-family zman: a heading naming the method
 * (with an explanation of what it measures behind an info popover) and its
 * shitot. When any of those rows is a short-night blank, the explanation for
 * the dashes joins that same popover — once for the family, never per row.
 */
function FamilyBlock({
  fam,
  locale,
  noDegreeTimeNote,
}: {
  fam: ZmanFamilyGroup;
  locale: string;
  noDegreeTimeNote: string;
}) {
  const showBlankNote = Boolean(noDegreeTimeNote) && fam.rows.some(isBlankMoment);
  const detail = showBlankNote ? withBlankNote(fam.description, noDegreeTimeNote) : fam.description;
  return (
    <div className="space-y-1">
      <span className="text-muted-foreground/80 flex items-center gap-1 text-[0.6875rem] font-medium">
        {fam.label}
        {detail && <InfoHint detail={detail} label={fam.label} />}
      </span>
      <div className="space-y-1 ps-2">
        {fam.rows.map((row) => (
          <ShitaRow key={row.key} row={row} locale={locale} />
        ))}
      </div>
    </div>
  );
}

/** Pure, hook-free grouped zmanim list — usable in both server and client components. */
export function ZmanimList({
  groups,
  locale = 'en',
  footnote,
  noDegreeTimeNote = '',
}: {
  groups: ZmanGroup[];
  locale?: string;
  /** Small muted note(s) under the list (e.g. "more zmanim in settings"). */
  footnote?: ReactNode;
  /**
   * The short-night explanation shown as a visible inline caption beside any
   * blank (no-time) zman. Pass an empty string to suppress it (e.g. on a true
   * polar day, where every opinion is blank and the caption wouldn't hold).
   */
  noDegreeTimeNote?: string;
}) {
  return (
    <div>
      <div className="space-y-4 2xl:grid 2xl:grid-cols-2 2xl:gap-x-10 2xl:gap-y-4 2xl:space-y-0">
        {groups.map((group) => (
          <section key={group.category}>
            <SectionHeading>{group.label}</SectionHeading>
            <ul className="space-y-1.5">
              {group.items.map((item) => (
                <BaseItem key={item.base} item={item} locale={locale} noDegreeTimeNote={noDegreeTimeNote} />
              ))}
            </ul>
          </section>
        ))}
      </div>
      {footnote && <div className="text-muted-foreground mt-4 space-y-1 text-xs">{footnote}</div>}
    </div>
  );
}
