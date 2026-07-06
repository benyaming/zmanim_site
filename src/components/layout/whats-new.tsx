'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { ReleaseNotesList } from '@/components/layout/release-notes';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { APP_VERSION, releasesSince } from '@/lib/releases';

const LAST_SEEN_VERSION_KEY = 'zmanim:last-seen-version:v1';

/**
 * The version the user last saw the changelog for. When storage is
 * unavailable, pretend the user is current — never nag on every load.
 */
function readLastSeenVersion(): string | null {
  try {
    return window.localStorage.getItem(LAST_SEEN_VERSION_KEY);
  } catch {
    return APP_VERSION;
  }
}

/**
 * One-time "What's new" popup: shown when the app version is newer than the
 * version the user last saw (all releases on the very first visit). The seen
 * version is stamped as soon as the popup renders, so each changelog is shown
 * at most once even if the popup is dismissed without reading.
 *
 * Read localStorage directly (not in an effect) — the app shell renders this
 * only after mount, so there's no SSR pass to disagree with.
 */
export function WhatsNewDialog() {
  const t = useTranslations('releases');
  const [unseen] = useState(() => releasesSince(readLastSeenVersion()));
  const [open, setOpen] = useState(unseen.length > 0);

  useEffect(() => {
    try {
      window.localStorage.setItem(LAST_SEEN_VERSION_KEY, APP_VERSION);
    } catch {
      // Best-effort: if only writes fail, the popup reappears next visit; if
      // reads fail too, readLastSeenVersion already suppressed it entirely.
    }
  }, []);

  if (unseen.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[min(80dvh,40rem)] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('subtitle')}</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 min-h-0 overflow-y-auto px-1">
          <ReleaseNotesList releases={unseen} />
        </div>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>{t('gotIt')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
