'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Shared icon-button-plus-dialog shell for the header's settings menus
 * (Appearance / Calendar / Tools). Each menu is its own trigger button, so they
 * read as distinct entries rather than tabs inside one dialog.
 *
 * The dialog is capped to the viewport height with the title pinned and the
 * body scrolling as one context, so long menus (like Calendar's pickers)
 * always fit on short screens.
 */
export function SettingsDialogShell({
  icon: Icon,
  label,
  title,
  wide,
  triggerClassName,
  triggerData,
  children,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  /** Wider layout for dense menus (checkbox pickers); default fits the simple ones. */
  wide?: boolean;
  /** Extra classes on the trigger button (e.g. `hidden sm:inline-flex` to hide it on phones). */
  triggerClassName?: string;
  /** Sets `data-hdr` on the trigger, so the header fit-detection can measure it. */
  triggerData?: string;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" aria-label={label} data-hdr={triggerData} className={triggerClassName}>
                <Icon className="size-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent
        // Wide menus also stretch on desktop — content there lays out in
        // columns instead of one narrow scrolling stack.
        className={cn('flex max-h-[85dvh] flex-col', wide ? 'sm:max-w-lg lg:max-w-3xl' : 'sm:max-w-sm')}
        // Radix focuses the first focusable element on open; when that's a text
        // input, mobile browsers pop the keyboard over the menu. Focus the
        // dialog container instead (Radix gives it tabIndex=-1): focus still
        // moves into the modal for keyboard/screen-reader users, but nothing
        // editable is focused so the keyboard stays closed.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {/* Negative margins keep the scrollbar on the dialog's edge instead of
            carving a track inside the padded content area. */}
        <div className="-mx-4 min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pt-2 pb-1">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
