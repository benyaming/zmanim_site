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
  children,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  /** Wider layout for dense menus (checkbox pickers); default fits the simple ones. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" aria-label={label}>
                <Icon className="size-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className={cn('flex max-h-[85dvh] flex-col', wide ? 'sm:max-w-lg' : 'sm:max-w-sm')}>
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
