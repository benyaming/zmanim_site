'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { subscribeToToasts, type ToastEvent } from '@/lib/toast';

const TOAST_DURATION_MS = 4000;

/**
 * Renders lib/toast messages: one small self-hiding pill above the footer.
 * A new toast replaces the current one (exports aren't bursty enough to need
 * a queue).
 */
export function Toaster() {
  const t = useTranslations();
  const [toast, setToast] = useState<ToastEvent | null>(null);

  useEffect(() => subscribeToToasts(setToast), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return (
    // z-[60]: dialogs/sheets sit at z-50 (and portal later in the DOM), and a
    // toast must stay readable over them — exports fire from inside a dialog.
    <div className="pointer-events-none fixed inset-x-0 bottom-14 z-[60] flex justify-center px-4" role="status">
      {/* The ring is a halo in the page-background color, so the pill stays
          readable over same-tone surfaces (e.g. a dark primary button). */}
      <div className="bg-foreground text-background ring-background max-w-full rounded-full px-4 py-2 text-sm shadow-lg ring-2">
        {t(toast.messageKey)}
      </div>
    </div>
  );
}
