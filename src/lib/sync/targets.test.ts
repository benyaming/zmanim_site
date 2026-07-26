import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installMemoryLocalStorage } from '@/test/memory-storage';

/**
 * Which stores `activeSyncTargets` offers, per environment. The Mini App case
 * is the load-bearing one: Google must not appear there — the bot already is
 * the store (via initData), so a second Google-keyed target would be redundant.
 */

const ACCOUNT = { key: 'a'.repeat(32), sig: 'b'.repeat(64) };

const isTelegramMiniApp = vi.fn();
const loadGoogleAccount = vi.fn();

vi.mock('@/lib/telegram/mini-app', () => ({
  isTelegramMiniApp: () => isTelegramMiniApp(),
  initTelegramMiniApp: () => Promise.resolve(null),
  telegramInitData: () => 'init-data',
  telegramUserId: () => '12345',
}));
vi.mock('@/lib/google/web-login', () => ({
  loadGoogleAccount: () => loadGoogleAccount(),
  googleAccountDisplayName: () => '',
}));
vi.mock('@/lib/telegram/bot-sync', () => ({
  botSyncEnabled: () => true,
  fetchBotProfile: vi.fn(),
  pushBotSync: vi.fn(),
}));
vi.mock('./google-websync', () => ({ pullFromGoogleWebSync: vi.fn(), pushToGoogleWebSync: vi.fn() }));
vi.mock('./telegram-cloud', () => ({
  cloudStorageAvailable: () => false,
  pullFromTelegramCloud: vi.fn(),
  pushToTelegramCloud: vi.fn(),
}));

async function targetIds(): Promise<string[]> {
  const { activeSyncTargets } = await import('./engine');
  return (await activeSyncTargets()).map((target) => target.id);
}

beforeEach(() => {
  installMemoryLocalStorage();
  vi.resetModules();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('activeSyncTargets', () => {
  it('offers the Google store on the plain website when signed in', async () => {
    isTelegramMiniApp.mockReturnValue(false);
    loadGoogleAccount.mockReturnValue(ACCOUNT);

    expect(await targetIds()).toContain('google-websync');
  });

  it('never offers the Google store inside the Telegram Mini App', async () => {
    isTelegramMiniApp.mockReturnValue(true);
    loadGoogleAccount.mockReturnValue(ACCOUNT); // even with a stored sign-in

    const ids = await targetIds();
    expect(ids).not.toContain('google-websync');
    expect(ids).toContain('telegram-bot');
  });

  it('offers no Google target when signed out', async () => {
    isTelegramMiniApp.mockReturnValue(false);
    loadGoogleAccount.mockReturnValue(null);

    expect(await targetIds()).not.toContain('google-websync');
  });
});
