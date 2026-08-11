'use client';

import { CircleQuestionMark } from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HELP, type HelpLocale } from '@/lib/help';
import { useLocale } from 'next-intl';

// The document computes two worked examples, so it is loaded only when the
// dialog is actually opened — it has no business in the first paint of the
// calendar.
const HelpContent = dynamic(() => import('./help-content').then((m) => m.HelpContent));

/**
 * Help — a header icon opening the explainer as a large dialog.
 *
 * A dialog rather than a route keeps the calculation guide beside the calendar
 * and its method labels instead of sending the reader to another page.
 *
 * Not built on SettingsDialogShell: this is a document, not a settings menu —
 * it wants the full reading width and no section spacing conventions.
 */
export function HelpMenu({ variant = 'icon' }: { variant?: 'icon' | 'link' }) {
  const locale = useLocale();
  const t = useTranslations('footer');
  const [open, setOpen] = useState(false);
  const doc = HELP[locale as HelpLocale] ?? HELP.en;

  const trigger =
    variant === 'link' ? (
      <button type="button" className="hover:text-foreground underline underline-offset-2">
        {t('help')}
      </button>
    ) : (
      <Button variant="outline" size="icon" aria-label={doc.title} data-hdr="help">
        <CircleQuestionMark className="size-4" />
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {variant === 'icon' ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>{trigger}</DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>{doc.title}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      )}
      <DialogContent
        // A reading document, not a settings menu: it takes 90% of the viewport
        // in both axes rather than the shell's narrow default.
        className="flex h-[90dvh] max-h-[90dvh] w-[90vw] max-w-[90vw] flex-col sm:max-w-[90vw]"
        // Same rationale as SettingsDialogShell: focus the container, not the
        // first focusable child, so mobile keyboards stay closed on open.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{doc.title}</DialogTitle>
        </DialogHeader>
        {/* Negative margins keep the scrollbar on the dialog's edge instead of
            carving a track inside the padded content area. */}
        <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-1">{open && <HelpContent />}</div>
      </DialogContent>
    </Dialog>
  );
}
