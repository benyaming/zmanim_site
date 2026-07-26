import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installMemoryLocalStorage } from '@/test/memory-storage';

import { lineageAccount, recordLineage } from './blob';

/**
 * Which stores `activeSyncTargets` offers, per environment. The Mini App case
 * is the load-bearing one: Google must not appear there — the bot already is
 * the store (via initData), so a second Google-keyed target would be redundant.
 *
 * The other invariant pinned here: AT MOST ONE ACCOUNT SYNCS. A device holding
 * both credentials must not push settings into two unrelated accounts (nor
 * bridge data between a Telegram-only and a Google-only device) — enforced
 * here, in the engine, not just by what the account panel offers.
 */

const ACCOUNT = { key: 'a'.repeat(32), sig: 'b'.repeat(64) };
const TG_AUTH = { id: 42, username: 'tg', auth_date: Math.floor(Date.now() / 1000), hash: 'h' };

const isTelegramMiniApp = vi.fn();
const loadGoogleAccount = vi.fn();
const loadTelegramWebAuth = vi.fn(() => null as typeof TG_AUTH | null);
const pushBotSync = vi.fn((...args: unknown[]) => Promise.resolve({ args }));

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
  pushBotSync: (auth: unknown, patch: unknown) => pushBotSync(auth, patch),
}));
vi.mock('@/lib/telegram/web-login', () => ({
  loadTelegramWebAuth: () => loadTelegramWebAuth(),
  webAuthDisplayName: () => '@tg',
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
  loadTelegramWebAuth.mockReturnValue(null);
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

  it('syncs only Telegram when a device holds both credentials', async () => {
    // The pairing the account panel no longer allows — but devices that made it
    // before still hold both. Syncing both would copy every setting into two
    // unrelated accounts and make this device a bridge between a Telegram-only
    // and a Google-only device. Telegram wins; Google stays signed in, dormant.
    isTelegramMiniApp.mockReturnValue(false);
    loadGoogleAccount.mockReturnValue(ACCOUNT);
    loadTelegramWebAuth.mockReturnValue(TG_AUTH);

    const ids = await targetIds();
    expect(ids).toEqual(['telegram-bot']);
  });

  it('forgets a sidelined Google lineage so re-activating it reconciles first', async () => {
    // A dormant store misses every push, so its stored blob goes stale while
    // the Telegram account moves on. If its lineage survived, disconnecting
    // Telegram would let the very next run treat the Google store as settled
    // and merge this device's state against it on equal terms, instead of
    // reconciling it as the fresh connect it effectively is.
    isTelegramMiniApp.mockReturnValue(false);
    loadGoogleAccount.mockReturnValue(ACCOUNT);
    loadTelegramWebAuth.mockReturnValue(TG_AUTH);
    recordLineage('google-websync', ACCOUNT.key);

    await targetIds();

    expect(lineageAccount('google-websync')).toBeNull();
  });

  it('writes only the settings blob to the bot — never the fields the bot itself models', async () => {
    // The bot owns location / cl_offset / havdala_opinion: it shows them in
    // chat and computes its own messages from them. The settings sync must
    // never write them — pushBotSync sends only the keys its patch carries, and
    // this target's patch carries exactly one. (Inside the Mini App they ARE
    // written, deliberately, but by TelegramMiniApp's own write-back — not by
    // any sync path.)
    isTelegramMiniApp.mockReturnValue(false);
    loadGoogleAccount.mockReturnValue(null);
    loadTelegramWebAuth.mockReturnValue(TG_AUTH);
    const { activeSyncTargets } = await import('./engine');
    const { collectSettingsBlob } = await import('./blob');

    const [target] = await activeSyncTargets();
    await target.push(collectSettingsBlob());

    expect(pushBotSync).toHaveBeenCalledTimes(1);
    expect(Object.keys(pushBotSync.mock.calls[0][1] as object)).toEqual(['webPrefs']);
  });

  it('offers the Google store again once Telegram is disconnected', async () => {
    isTelegramMiniApp.mockReturnValue(false);
    loadGoogleAccount.mockReturnValue(ACCOUNT);
    loadTelegramWebAuth.mockReturnValue(null);

    expect(await targetIds()).toEqual(['google-websync']);
  });
});
