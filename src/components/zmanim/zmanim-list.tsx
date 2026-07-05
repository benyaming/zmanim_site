import type { DateTime } from 'luxon';

import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ZmanBaseGroup, ZmanGroup } from '@/lib/zmanim';

import { InfoHint } from './info-hint';
import { SectionHeading } from './section-heading';

function Time({ time, locale }: { time: DateTime | null; locale: string }) {
  return (
    <time className={cn('shrink-0 font-mono text-sm tabular-nums', !time && 'text-muted-foreground')}>
      {formatTime(time, locale)}
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

function BaseItem({ item, locale }: { item: ZmanBaseGroup; locale: string }) {
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
        <Time time={row.time} locale={locale} />
      </li>
    );
  }

  // Several opinions → name (with its description behind an info popover), then a
  // compact row per shita. The opinion-specific detail hides behind its own info
  // icon so nothing clutters the list, but every explanation stays one tap away.
  return (
    <li>
      <ZmanName name={item.name} description={item.description} />
      <div className="mt-1 space-y-1 ps-3">
        {item.rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              {row.shita}
              {row.detail && <InfoHint detail={row.detail} label={row.shita} />}
            </span>
            <Time time={row.time} locale={locale} />
          </div>
        ))}
      </div>
    </li>
  );
}

/** Pure, hook-free grouped zmanim list — usable in both server and client components. */
export function ZmanimList({
  groups,
  locale = 'en',
  footnote,
}: {
  groups: ZmanGroup[];
  locale?: string;
  /** Small muted note under the list (e.g. "more zmanim in settings"). */
  footnote?: string;
}) {
  return (
    <div>
      <div className="space-y-4 2xl:grid 2xl:grid-cols-2 2xl:gap-x-10 2xl:gap-y-4 2xl:space-y-0">
        {groups.map((group) => (
          <section key={group.category}>
            <SectionHeading>{group.label}</SectionHeading>
            <ul className="space-y-1.5">
              {group.items.map((item) => (
                <BaseItem key={item.base} item={item} locale={locale} />
              ))}
            </ul>
          </section>
        ))}
      </div>
      {footnote && <p className="text-muted-foreground mt-4 text-xs">{footnote}</p>}
    </div>
  );
}
