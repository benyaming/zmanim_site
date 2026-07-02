import type { DateTime } from 'luxon';

import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ZmanBaseGroup, ZmanGroup } from '@/lib/zmanim';

import { InfoHint } from './info-hint';

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
  // Single opinion → flat row.
  if (item.rows.length === 1) {
    const row = item.rows[0];
    return (
      <li className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <ZmanName name={item.name} description={item.description} />
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
export function ZmanimList({ groups, locale = 'en' }: { groups: ZmanGroup[]; locale?: string }) {
  return (
    <div className="space-y-4 2xl:grid 2xl:grid-cols-2 2xl:gap-x-10 2xl:gap-y-4 2xl:space-y-0">
      {groups.map((group) => (
        <section key={group.category}>
          <h4 className="text-muted-foreground/70 mb-1.5 text-[0.6875rem] font-semibold tracking-[0.08em] uppercase">
            {group.label}
          </h4>
          <ul className="space-y-1.5">
            {group.items.map((item) => (
              <BaseItem key={item.base} item={item} locale={locale} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
