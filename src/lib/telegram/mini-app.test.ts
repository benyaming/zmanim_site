import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TelegramWebApp } from './mini-app';

type MiniAppModule = typeof import('./mini-app');

// The module captures the launch hash at load, so each test sets up the URL
// first and then imports a fresh copy.
async function freshModule(hash = ''): Promise<MiniAppModule> {
  window.history.replaceState(null, '', `/${hash}`);
  vi.resetModules();
  return import('./mini-app');
}

// tgWebAppData as Telegram sends it: a percent-encoded query string value.
const RAW_INIT_DATA = 'query_id=AAA&user=%7B%22id%22%3A42%7D&auth_date=1700000000&hash=abc123';
const LAUNCH_HASH = `#tgWebAppData=${encodeURIComponent(RAW_INIT_DATA)}&tgWebAppVersion=8.0&tgWebAppPlatform=ios`;

afterEach(() => {
  window.sessionStorage.clear();
  delete (window as { Telegram?: unknown }).Telegram;
  delete (window as { TelegramWebviewProxy?: unknown }).TelegramWebviewProxy;
  window.history.replaceState(null, '', '/');
});

describe('isTelegramMiniApp', () => {
  it('is false in a plain browser (no launch hash, no remembered flag)', async () => {
    const { isTelegramMiniApp, telegramInitData } = await freshModule();
    expect(isTelegramMiniApp()).toBe(false);
    expect(telegramInitData()).toBeNull();
  });

  it('detects the Telegram launch hash and decodes its initData', async () => {
    const { isTelegramMiniApp, telegramInitData } = await freshModule(LAUNCH_HASH);
    expect(isTelegramMiniApp()).toBe(true);
    expect(telegramInitData()).toBe(RAW_INIT_DATA);
  });

  it('detects a native webview that omitted the launch fragment, reading initData from the SDK', async () => {
    const fresh = await freshModule(); // no hash at all
    window.TelegramWebviewProxy = {};
    window.Telegram = {
      WebApp: {
        initData: RAW_INIT_DATA,
        version: '8.0',
        platform: 'macos',
        ready: () => {},
        expand: () => {},
        isVersionAtLeast: () => true,
      },
    };
    expect(fresh.isTelegramMiniApp()).toBe(true);
    expect(fresh.telegramInitData()).toBe(RAW_INIT_DATA);
  });

  it('survives an in-webview reload that lost the hash, via sessionStorage', async () => {
    const first = await freshModule(LAUNCH_HASH);
    void first.initTelegramMiniApp(); // the remember step is synchronous

    const reloaded = await freshModule(); // no hash this time
    expect(reloaded.isTelegramMiniApp()).toBe(true);
    expect(reloaded.telegramInitData()).toBe(RAW_INIT_DATA);
  });
});

describe('initTelegramMiniApp', () => {
  it('configures the webview: ready, expand, and no vertical swipes on 7.7+', async () => {
    const miniApp = await freshModule(LAUNCH_HASH);
    const calls: string[] = [];
    const webApp: TelegramWebApp = {
      initData: RAW_INIT_DATA,
      version: '8.0',
      platform: 'ios',
      ready: () => calls.push('ready'),
      expand: () => calls.push('expand'),
      isVersionAtLeast: (v) => v <= '8.0',
      disableVerticalSwipes: () => calls.push('disableVerticalSwipes'),
    };
    window.Telegram = { WebApp: webApp };

    await miniApp.initTelegramMiniApp();
    expect(calls).toEqual(['ready', 'expand', 'disableVerticalSwipes']);
  });

  it('skips disableVerticalSwipes on clients older than 7.7', async () => {
    const miniApp = await freshModule(LAUNCH_HASH);
    const calls: string[] = [];
    window.Telegram = {
      WebApp: {
        initData: RAW_INIT_DATA,
        version: '6.0',
        platform: 'android',
        ready: () => calls.push('ready'),
        expand: () => calls.push('expand'),
        isVersionAtLeast: () => false,
        disableVerticalSwipes: () => calls.push('disableVerticalSwipes'),
      },
    };

    await miniApp.initTelegramMiniApp();
    expect(calls).toEqual(['ready', 'expand']);
  });

  it('restores the launch hash if the URL was rewritten before the SDK loaded', async () => {
    const miniApp = await freshModule(LAUNCH_HASH);
    // Simulate the app-state URL-reflect effect stripping the fragment.
    window.history.replaceState(null, '', '/?m=gregorian');
    window.Telegram = {
      WebApp: {
        initData: RAW_INIT_DATA,
        version: '8.0',
        platform: 'ios',
        ready: () => {},
        expand: () => {},
        isVersionAtLeast: () => true,
        disableVerticalSwipes: () => {},
      },
    };

    await miniApp.initTelegramMiniApp();
    expect(window.location.hash).toBe(LAUNCH_HASH);
    expect(window.location.search).toBe('?m=gregorian');
  });

  it('does nothing outside Telegram', async () => {
    const miniApp = await freshModule();
    await miniApp.initTelegramMiniApp();
    expect(window.sessionStorage.length).toBe(0);
  });
});
