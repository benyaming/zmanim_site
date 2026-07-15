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
 * Controlled so it reveals on HOVER for a mouse (pointer-enter/leave) — no
 * click needed, which is the point. Radix's own trigger still toggles it on
 * tap (touch), on click, and on Enter/Space (keyboard), and closes it on
 * outside-press or Escape — so it's reachable on every input, unlike a
 * hover-only tooltip that touch users couldn't reach.
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
