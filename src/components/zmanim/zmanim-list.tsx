import type { DateTime } from 'luxon';

import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ZmanBaseGroup, ZmanGroup } from '@/lib/zmanim';

import { ShitaInfo } from './shita-info';

function Time({ time, locale }: { time: DateTime | null; locale: string }) {
  return (
    <time className={cn('shrink-0 font-mono text-sm tabular-nums', !time && 'text-muted-foreground')}>
      {formatTime(time, locale)}
    </time>
  );
}

function BaseItem({ item, locale }: { item: ZmanBaseGroup; locale: string }) {
  // Single opinion → flat row.
  if (item.rows.length === 1) {
    const row = item.rows[0];
    return (
      <li className="flex items-start justify-between gap-3 py-1.5">
        <div className="min-w-0">
          <p className="text-sm font-medium">{item.name}</p>
          {item.description && <p className="text-muted-foreground mt-0.5 text-xs leading-snug">{item.description}</p>}
        </div>
        <Time time={row.time} locale={locale} />
      </li>
    );
  }

  // Several opinions → name + one description for the whole zman, then a compact
  // row per shita. The opinion-specific detail is tucked behind an info icon
  // (tap/click popover) so it doesn't clutter the list but stays reachable.
  return (
    <li className="py-1.5">
      <p className="text-sm font-medium">{item.name}</p>
      {item.description && <p className="text-muted-foreground mt-0.5 text-xs leading-snug">{item.description}</p>}
      <div className="mt-1.5 space-y-1 ps-3">
        {item.rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              {row.shita}
              {row.detail && <ShitaInfo detail={row.detail} label={row.shita} />}
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
    <div className="space-y-4 2xl:grid 2xl:grid-cols-2 2xl:gap-x-8 2xl:gap-y-4 2xl:space-y-0">
      {groups.map((group) => (
        <section key={group.category}>
          <h4 className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">{group.label}</h4>
          <ul className="divide-border divide-y">
            {group.items.map((item) => (
              <BaseItem key={item.base} item={item} locale={locale} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
