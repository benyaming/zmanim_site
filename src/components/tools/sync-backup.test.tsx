import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

import messages from '../../../messages/en.json';
import type { GoogleAccount } from '@/lib/google/web-login';
import type { TelegramWebAuth } from '@/lib/telegram/web-login';

const mountTelegramLoginWidget = vi.fn(() => () => {});
const mountGoogleSignInButton = vi.fn(() => () => {});
let webAuth: TelegramWebAuth | null = null;
let googleAccount: GoogleAccount | null = null;
let miniApp = false;

vi.mock('@/hooks/use-mini-app', () => ({ useIsMiniApp: () => miniApp }));
// The privacy link only needs to render its text here; next-intl's Link wants a
// router context jsdom has no reason to provide.
vi.mock('@/i18n/navigation', () => ({ Link: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock('@/lib/export/download', () => ({ downloadBlob: vi.fn() }));
vi.mock('@/lib/toast', () => ({ showToast: vi.fn() }));
vi.mock('@/lib/sync/engine', () => ({
  applyImportedSettings: vi.fn(),
  reloadForSync: vi.fn(),
  runSync: vi.fn(async () => ({ outcome: 'clean', appliedLanguage: null, conflicts: [] })),
}));
vi.mock('@/lib/sync/google-websync', () => ({ deleteGoogleWebSync: vi.fn(async () => true) }));
vi.mock('@/lib/sync/transfer', () => ({
  buildSettingsLink: () => null,
  parseSettingsFile: () => null,
  SETTINGS_FILE_NAME: 'settings.json',
  settingsFileBlob: () => new Blob(),
}));
vi.mock('@/lib/telegram/bot-sync', () => ({ botSyncEnabled: () => true, botApiBase: () => 'https://bot.test' }));
vi.mock('@/lib/telegram/web-login', () => ({
  clearTelegramWebAuth: vi.fn(),
  loadTelegramWebAuth: () => webAuth,
  mountTelegramLoginWidget,
  saveTelegramWebAuth: vi.fn(),
  telegramWebLoginConfigured: () => true,
  webAuthDisplayName: (auth: TelegramWebAuth) => `@${auth.username}`,
}));
vi.mock('@/lib/google/web-login', () => ({
  GOOGLE_AUTH_EVENT: 'zmanim:google-auth',
  googleAccountDisplayName: (account: GoogleAccount) => account.name ?? '',
  googleLoginConfigured: () => true,
  loadGoogleAccount: () => googleAccount,
  mountGoogleSignInButton,
  signOutFromGoogle: vi.fn(),
}));

const { SyncBackupTool } = await import('./sync-backup');

const TG: TelegramWebAuth = { id: 42, first_name: 'B', username: 'Benyomin', auth_date: 1, hash: 'x' } as TelegramWebAuth;
const GOOGLE: GoogleAccount = { key: 'k', sig: 's', name: 'Benyamin Ginzburg', email: 'b@example.com' };

const show = () =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SyncBackupTool />
    </NextIntlClientProvider>,
  );

beforeEach(() => {
  webAuth = null;
  googleAccount = null;
  miniApp = false;
  mountTelegramLoginWidget.mockClear();
  mountGoogleSignInButton.mockClear();
});
afterEach(() => vi.clearAllMocks());

/**
 * One sync account at a time: connecting both would mirror every setting into
 * two unrelated accounts, and the device holding both would bridge data between
 * a Telegram-only and a Google-only device. Each provider's sign-in is withheld
 * while the other is connected.
 */
describe('SyncBackupTool account exclusivity', () => {
  it('offers both sign-ins when nothing is connected', () => {
    show();
    expect(mountTelegramLoginWidget).toHaveBeenCalled();
    expect(mountGoogleSignInButton).toHaveBeenCalled();
  });

  it('withholds the Google sign-in while Telegram is connected', () => {
    webAuth = TG;
    show();
    expect(mountGoogleSignInButton).not.toHaveBeenCalled();
    expect(screen.getByText(messages.sync.googleBlocked)).toBeInTheDocument();
    // The privacy note belongs to the sign-in flow and goes with the button.
    expect(screen.queryByText(/How your data is handled/)).not.toBeInTheDocument();
  });

  it('withholds the Telegram sign-in while Google is connected', () => {
    googleAccount = GOOGLE;
    show();
    expect(mountTelegramLoginWidget).not.toHaveBeenCalled();
    expect(screen.getByText(messages.sync.tgBlocked)).toBeInTheDocument();
  });

  it('shows the Google account as inactive on a device that paired both before the gate', () => {
    webAuth = TG;
    googleAccount = GOOGLE;
    show();
    expect(screen.getByText('Connected as @Benyomin.')).toBeInTheDocument();
    expect(screen.getByText('Signed in as Benyamin Ginzburg.')).toBeInTheDocument();
    // The engine syncs Telegram and sidelines Google (activeSyncTargets), so
    // the panel says so rather than offering a sync that won't happen…
    expect(screen.getByText(messages.sync.googleInactive)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: messages.sync.syncNow })).toHaveLength(1);
    // …and neither credential is dropped behind the user's back: both remain
    // theirs to disconnect.
    expect(screen.getByRole('button', { name: messages.sync.disconnect })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.sync.signOut })).toBeInTheDocument();
  });
});
