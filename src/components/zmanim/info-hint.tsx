'use client';

import { Info } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * A small info icon revealing an explanation (a zman's description or an
 * opinion-specific detail). Uses a Popover (tap/click) rather than a hover-only
 * tooltip so it works on touch devices too.
 */
export function InfoHint({ detail, label }: { detail: string; label: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label} — details`}
          className="text-muted-foreground/40 hover:text-foreground focus-visible:ring-ring inline-flex shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Info className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3 text-xs leading-snug">
        {detail}
      </PopoverContent>
    </Popover>
  );
}
