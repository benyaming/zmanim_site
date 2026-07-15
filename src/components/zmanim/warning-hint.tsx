'use client';

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * A small red warning icon revealing a caution (currently: a time shown as a
 * short-night seasonal-hour approximation because its degree-based calculation
 * was undefined).
 *
 * Reveals on HOVER for a mouse and on TAP for touch — not on a deliberate click.
 * The Popover is controlled: mouse pointer-enter/leave opens/closes it, while
 * Radix's own trigger still handles tap (touch), keyboard (Enter/Space),
 * outside-press and Escape — so it works on every input without a hover-only
 * tooltip that touch users couldn't reach.
 */
export function WarningHint({ detail, label }: { detail: string; label: string }) {
  const t = useTranslations('panel');
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('warningAria', { label })}
          className="focus-visible:ring-ring inline-flex shrink-0 items-center rounded-full text-rose-600 transition-colors hover:text-rose-700 focus-visible:ring-2 focus-visible:outline-none dark:text-rose-400 dark:hover:text-rose-300"
          onPointerEnter={(e) => {
            if (e.pointerType === 'mouse') setOpen(true);
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') setOpen(false);
          }}
        >
          <TriangleAlert className="size-3" />
        </button>
      </PopoverTrigger>
      {/* Don't pull focus on open — a hover reveal shouldn't move the caret. */}
      <PopoverContent
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-64 p-3 text-xs leading-snug whitespace-pre-line"
      >
        {detail}
      </PopoverContent>
    </Popover>
  );
}
