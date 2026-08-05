'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { PAGE_HEIGHT_PX, PAGE_WIDTH_PX } from '@/lib/export';
import { cn } from '@/lib/utils';

import { buildZmanimPdfPages, type PdfDocConfig } from './export-pdf-doc';

/**
 * Live preview of the PDF: the SAME page components the download rasterizes,
 * scaled to the dialog. There is no separate preview layout to drift out of
 * sync — what is shown is what prints, so "will this selection fit one sheet?"
 * is answered by looking, not by warning texts.
 *
 * Rebuilding runs the whole pipeline (zmanim for every day of the range), so it
 * is debounced behind the last keystroke. The config arrives as a plain
 * serializable object; its JSON string is both the debounce key and — parsed
 * back — the build input, which keeps the effect's dependency honest.
 */
export function ExportPdfPreview({ config }: { config: PdfDocConfig | null }) {
  const t = useTranslations('export');
  const [built, setBuilt] = useState<{ pages: ReactNode[]; count: number; key: string } | null>(null);
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(0);
  const roRef = useRef<ResizeObserver | null>(null);

  const key = config ? JSON.stringify(config) : '';

  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(() => {
      try {
        const { pages } = buildZmanimPdfPages(JSON.parse(key) as PdfDocConfig);
        setBuilt({ pages, count: pages.length, key });
      } catch {
        setBuilt({ pages: [], count: 0, key });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [key]);

  // Measured, not assumed: the dialog is responsive and the page keeps its A4
  // aspect by scaling to whatever width the box actually has.
  const hostRef = (el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (el) {
      const ro = new ResizeObserver((entries) => setWidth(entries[0]?.contentRect.width ?? 0));
      ro.observe(el);
      roRef.current = ro;
    }
  };

  const pages = built?.pages ?? [];
  const current = Math.min(page, Math.max(0, pages.length - 1));
  const stale = key !== '' && built?.key !== key;
  const scale = width > 0 ? width / PAGE_WIDTH_PX : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {t('preview')}
          {pages.length > 0 && (
            <span className="text-muted-foreground ml-2 text-xs font-normal">{t('sheetsCount', { count: pages.length })}</span>
          )}
        </span>
        {pages.length > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => setPage(Math.max(0, current - 1))}
              disabled={current === 0}
              aria-label={t('previewPrev')}
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
            </Button>
            <span className="text-muted-foreground min-w-10 text-center text-xs tabular-nums">
              {current + 1} / {pages.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => setPage(Math.min(pages.length - 1, current + 1))}
              disabled={current >= pages.length - 1}
              aria-label={t('previewNext')}
            >
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
          </div>
        )}
      </div>

      <div ref={hostRef} className="w-full">
        {!key || pages.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-xs">
            {t('noColumns')}
          </p>
        ) : (
          width > 0 && (
            <div
              className={cn('relative overflow-hidden rounded-md border shadow-sm transition-opacity', stale && 'opacity-60')}
              style={{ height: Math.round(PAGE_HEIGHT_PX * scale) }}
            >
              <div
                dir="ltr"
                className="absolute top-0 left-0"
                style={{
                  width: PAGE_WIDTH_PX,
                  height: PAGE_HEIGHT_PX,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                }}
              >
                {pages[current]}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
