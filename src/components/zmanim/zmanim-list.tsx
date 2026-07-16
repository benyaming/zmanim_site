import type { ReactNode } from 'react';

import { formatDuration, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ZmanBaseGroup, ZmanFamilyGroup, ZmanGroup, ZmanRow } from '@/lib/zmanim';

import { InfoHint } from './info-hint';
import { SectionHeading } from './section-heading';

function Time({
  time,
  durationMillis,
  locale,
  noDegreeTimeNote,
  label,
}: Pick<ZmanRow, 'time' | 'durationMillis'> & {
  locale: string;
  noDegreeTimeNote: string;
  label: string;
}) {
  // Duration zmanim (shaah zmanis) carry a length, not a moment — render h:mm:ss.
  const isDuration = durationMillis !== undefined;
  const text = isDuration ? formatDuration(durationMillis) : formatTime(time, locale);
  // A blank moment isn't missing data — the sun never reached the angle behind
  // this opinion today (directly, or via the dawn/nightfall that bounds a
  // day-fraction). Say so, rather than leaving a bare dash a user reads as a
  // bug. The caller passes an empty note on a true polar day (everything is
  // blank, so "see the other rows" would be false); durations never explain.
  const explainBlank = time === null && !isDuration && Boolean(noDegreeTimeNote);
  return (
    <span className="flex shrink-0 items-center gap-1">
      {explainBlank && <InfoHint detail={noDegreeTimeNote} label={label} />}
      <time className={cn('font-mono text-sm tabular-nums', text === '—' && 'text-muted-foreground')}>{text}</time>
    </span>
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
  // Single opinion → flat row, with the shita inline next to the name (an
  // indented one-row block would waste a line). flex-wrap drops the shita
  // under the name when the row is too narrow to fit everything.
  if (item.rows.length === 1) {
    const row = item.rows[0];
    return (
      <li className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5">
          <ZmanName name={item.name} description={item.description} />
          {row.shita && <span className="text-muted-foreground text-xs">{row.shita}</span>}
        </div>
        <Time
          time={row.time}
          durationMillis={row.durationMillis}
          locale={locale}
          noDegreeTimeNote={noDegreeTimeNote}
          label={item.name}
        />
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
  // Flat path: if EVERY opinion is blank for the same short-night reason, explain
  // it once — the name's own info popover carries the explanation instead of the
  // general description (there are no times to describe anyway), and the rows
  // drop their per-row hints. This avoids stamping an identical icon on all N
  // rows (e.g. all five Misheyakir degrees at a very high latitude); the grouped
  // path does the equivalent per-family on its headings.
  const flatAllBlank =
    !grouped && Boolean(noDegreeTimeNote) && item.rows.every((r) => r.time === null && r.durationMillis === undefined);
  return (
    <li>
      <ZmanName name={item.name} description={flatAllBlank ? noDegreeTimeNote : item.description} />
      <div className="mt-1 space-y-1 ps-3">
        {grouped
          ? item.families.map((fam) => (
              <FamilyBlock
                key={fam.family}
                fam={fam}
                item={item}
                locale={locale}
                noDegreeTimeNote={noDegreeTimeNote}
              />
            ))
          : item.rows.map((row) => (
              <ShitaRow
                key={row.key}
                row={row}
                item={item}
                locale={locale}
                noDegreeTimeNote={flatAllBlank ? '' : noDegreeTimeNote}
              />
            ))}
      </div>
    </li>
  );
}

/** One shita line: its label (with detail behind info) and its time. */
function ShitaRow({
  row,
  item,
  locale,
  noDegreeTimeNote,
}: {
  row: ZmanRow;
  item: ZmanBaseGroup;
  locale: string;
  noDegreeTimeNote: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        {row.shita}
        {row.detail && <InfoHint detail={row.detail} label={row.shita} />}
      </span>
      <Time
        time={row.time}
        durationMillis={row.durationMillis}
        locale={locale}
        noDegreeTimeNote={noDegreeTimeNote}
        label={row.shita || item.name}
      />
    </div>
  );
}

/**
 * One calculation family under a multi-family zman: a heading naming the method
 * (with an explanation of what it measures behind an info popover), then its
 * shitot.
 */
function FamilyBlock({
  fam,
  item,
  locale,
  noDegreeTimeNote,
}: {
  fam: ZmanFamilyGroup;
  item: ZmanBaseGroup;
  locale: string;
  noDegreeTimeNote: string;
}) {
  // When this whole family is blank for the same short-night reason — a degrees
  // family whose angle is unreached, or a dawn-to-nightfall family whose degree
  // boundary is — explain it once on the heading rather than repeating an
  // identical hint down the column. A partially-blank family keeps its per-row
  // hints, since there the blank is what distinguishes the rows. (The caller
  // passes an empty note on a polar day, so this never fires when there's no
  // resolving family to point at.)
  const allBlank = fam.rows.every((r) => r.time === null && r.durationMillis === undefined);
  const explainOnHeading = allBlank && Boolean(noDegreeTimeNote);
  return (
    <div className="space-y-1">
      <span className="text-muted-foreground/80 flex items-center gap-1 text-[0.6875rem] font-medium">
        {fam.label}
        {explainOnHeading ? (
          <InfoHint detail={noDegreeTimeNote} label={fam.label} />
        ) : (
          fam.description && <InfoHint detail={fam.description} label={fam.label} />
        )}
      </span>
      <div className="space-y-1 ps-2">
        {fam.rows.map((row) => (
          <ShitaRow
            key={row.key}
            row={row}
            item={item}
            locale={locale}
            noDegreeTimeNote={explainOnHeading ? '' : noDegreeTimeNote}
          />
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
   * Explanation shown behind an info hint on a degree-based zman that has no
   * time today (the sun never reaches its angle). Omitted = bare dash.
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
