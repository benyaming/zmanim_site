'use client';

import { useSyncExternalStore } from 'react';

import { CalendarGrid } from '@/components/calendar/calendar-grid';
import { CalendarView } from '@/components/calendar/calendar-view';
import { AppearanceSettings } from '@/components/layout/appearance-settings';
import { CalendarSettings } from '@/components/layout/calendar-settings';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ToolsMenu } from '@/components/layout/tools-menu';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { Toaster } from '@/components/layout/toaster';
import { WhatsNewDialog } from '@/components/layout/whats-new';
import { LocationPicker } from '@/components/location/location-picker';
import { AppStateProvider, type AppLocation } from '@/components/providers/app-state';
import { QueryProvider } from '@/components/providers/query-provider';
import { SettingsSync } from '@/components/providers/settings-sync';
import { TelegramMiniApp } from '@/components/providers/telegram-mini-app';
import { Skeleton } from '@/components/ui/skeleton';
import { ZmanimPanel } from '@/components/zmanim/zmanim-panel';

function AppSkeleton() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[2200px] flex-col px-4 py-3">
      <Skeleton className="mb-3 h-9 w-48 shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <Skeleton className="min-h-0 flex-1 lg:flex-[2] 2xl:flex-[3]" />
        <Skeleton className="min-h-0 flex-1 2xl:flex-[2]" />
      </div>
    </div>
  );
}

const noopSubscribe = () => () => {};

/** True only on the client, false during SSR — without setState-in-effect. */
function useIsClient() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function App({ initialLocation }: { initialLocation?: AppLocation }) {
  // The calendar depends on the current date; render only after mount so server
  // and client agree (no hydration mismatch on "today"/selected highlights).
  const mounted = useIsClient();

  return (
    <QueryProvider>
      <AppStateProvider initialLocation={initialLocation}>
        {/* No-op outside Telegram; inside it, sets up the webview and syncs the bot profile. */}
        <TelegramMiniApp />
        {/* Mount-gated: it reconciles localStorage with the connected sync stores. */}
        {mounted && <SettingsSync />}
        {/* Desktop (lg+): a fixed-viewport shell that never scrolls — the
            calendar grid flexes to fill the height and only the zmanim panel
            scrolls internally. Mobile: a normal scrolling page so the stacked
            calendar and zmanim panel are both reachable. */}
        <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
          <SiteHeader
            right={
              <>
                <LocationPicker />
                <ToolsMenu />
                <LanguageSwitcher />
                <AppearanceSettings />
                <CalendarSettings />
              </>
            }
          />
          <main className="flex-1 lg:min-h-0">
            {mounted ? (
              <div className="mx-auto flex w-full max-w-[2200px] flex-col px-4 py-3 lg:h-full">
                <div className="flex flex-1 flex-col gap-4 lg:min-h-0 lg:flex-row">
                  <div className="flex flex-col gap-2 lg:min-h-0 lg:flex-[2] 2xl:flex-[3]">
                    <CalendarView />
                    <CalendarGrid />
                  </div>
                  <div className="flex-1 lg:min-h-0 2xl:flex-[2]">
                    <ZmanimPanel />
                  </div>
                </div>
              </div>
            ) : (
              <AppSkeleton />
            )}
          </main>
          {/* Mount-gated: it reads localStorage synchronously, so it must never render on the server. */}
          {mounted && <WhatsNewDialog />}
          <Toaster />
          <SiteFooter />
        </div>
      </AppStateProvider>
    </QueryProvider>
  );
}
