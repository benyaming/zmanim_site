'use client';

import { ArrowDownToLine, ArrowLeft, CalendarRange, ChevronRight, LayoutGrid, Table2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ComponentType } from 'react';

import { ExportCalendarTool } from '@/components/tools/export-calendar';
import { ExportZmanimTool } from '@/components/tools/export-zmanim';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type ToolKey = 'calendar' | 'zmanim';

interface ToolEntry {
  key: ToolKey;
  Icon: ComponentType<{ className?: string }>;
  Tool: ComponentType;
  /** Message keys under `export` for the catalog name and one-line description. */
  nameKey: string;
  descKey: string;
  /** Dialog width for this tool's view — wide desktop tools lay out in columns. */
  dialogClass: string;
  /** Overlay a download-arrow badge on the catalog icon (tools that produce a file). */
  download: boolean;
}

const TOOLS: ToolEntry[] = [
  { key: 'calendar', Icon: CalendarRange, Tool: ExportCalendarTool, nameKey: 'calendarName', descKey: 'calendarDesc', dialogClass: 'sm:max-w-lg lg:max-w-4xl', download: true },
  { key: 'zmanim', Icon: Table2, Tool: ExportZmanimTool, nameKey: 'zmanimName', descKey: 'zmanimDesc', dialogClass: 'sm:max-w-lg lg:max-w-3xl', download: true },
];

/**
 * Tools menu. The dialog opens on a catalog — icon + name + short description
 * per tool — and drills into the selected tool, with a back button in the
 * header. Selection resets when the dialog closes.
 *
 * Not built on SettingsDialogShell: the title and width here change with the
 * active view, which the shared shell deliberately doesn't support.
 */
export function ToolsMenu() {
  const t = useTranslations('settings');
  const tExport = useTranslations('export');
  const [open, setOpen] = useState(false);
  const [toolKey, setToolKey] = useState<ToolKey | null>(null);
  const active = TOOLS.find((tool) => tool.key === toolKey) ?? null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setToolKey(null);
      }}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" aria-label={t('toolsOpen')}>
                <LayoutGrid className="size-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>{t('toolsOpen')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent
        className={cn('flex max-h-[85dvh] flex-col', active ? active.dialogClass : 'sm:max-w-md')}
        // Same rationale as SettingsDialogShell: keep mobile keyboards closed on open.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-1.5">
            {active && (
              <Button
                variant="ghost"
                size="icon"
                className="-ms-2 size-7"
                onClick={() => setToolKey(null)}
                aria-label={tExport('back')}
              >
                <ArrowLeft className="size-4 rtl:rotate-180" />
              </Button>
            )}
            <DialogTitle>{active ? tExport(active.nameKey) : t('toolsTitle')}</DialogTitle>
          </div>
        </DialogHeader>
        <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-1">
          {active ? (
            <active.Tool />
          ) : (
            <div className="space-y-2">
              {TOOLS.map(({ key, Icon, nameKey, descKey, download }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setToolKey(key)}
                  className="hover:bg-muted/50 flex w-full items-center gap-3 rounded-lg border p-3 text-start transition-colors"
                >
                  <span className="bg-muted relative flex size-10 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="size-5" />
                    {download && (
                      <span className="bg-primary text-primary-foreground absolute -end-1 -bottom-1 flex size-4 items-center justify-center rounded-full">
                        <ArrowDownToLine className="size-2.5" />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{tExport(nameKey)}</span>
                    <span className="text-muted-foreground block text-xs">{tExport(descKey)}</span>
                  </span>
                  <ChevronRight className="text-muted-foreground size-4 shrink-0 rtl:rotate-180" />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
