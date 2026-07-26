import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installMemoryLocalStorage } from '@/test/memory-storage';

type WebSyncModule = typeof import('./google-websync');
type LoginModule = typeof import('@/lib/google/web-login');

const ACCOUNT = { key: 'a'.repeat(32), sig: 'b'.repeat(64), name: 'Rivka' };
const ACCOUNT_KEY = 'zmanim:google-account:v2';

/** Fresh modules with the bot base + client id configured (both read at load). */
async function fresh(): Promise<{ ws: WebSyncModule; login: LoginModule }> {
  vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', 'client.apps.googleusercontent.com');
  vi.stubEnv('NEXT_PUBLIC_TG_BOT_API_URL', 'https://bot.test/miniapp');
  vi.resetModules();
  return { ws: await import('./google-websync'), login: await import('@/lib/google/web-login') };
}

function fetchReturning(status: number, json: unknown = {}) {
  const mock = vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(json) });
  vi.stubGlobal('fetch', mock);
  return mock;
}

beforeEach(() => {
  installMemoryLocalStorage();
  window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(ACCOUNT));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('google-websync', () => {
  it('pull returns PULL_FAILED on a transient error and keeps the credential', async () => {
    const { ws, login } = await fresh();
    const { PULL_FAILED } = await import('./blob');
    fetchReturning(500);

    expect(await ws.pullFromGoogleWebSync(ACCOUNT)).toBe(PULL_FAILED);
    expect(login.loadGoogleAccount()).not.toBeNull(); // 500 is transient — don't sign the user out
  });

  it('pull invalidates the stored account on a 401 (stale sig after rotation)', async () => {
    const { ws, login } = await fresh();
    fetchReturning(401);

    await ws.pullFromGoogleWebSync(ACCOUNT);

    expect(login.loadGoogleAccount()).toBeNull(); // dropped so the panel re-prompts sign-in
  });

  it('pull invalidates the stored account on a 404 (row reaped / unknown key)', async () => {
    const { ws, login } = await fresh();
    fetchReturning(404);

    expect(await ws.pullFromGoogleWebSync(ACCOUNT)).toBe((await import('./blob')).PULL_FAILED);
    expect(login.loadGoogleAccount()).toBeNull(); // re-sign-in re-creates the account-linked row
  });

  it('deletes the account data on the server', async () => {
    const { ws } = await fresh();
    const mock = fetchReturning(200, { deleted: true });

    expect(await ws.deleteGoogleWebSync(ACCOUNT)).toBe(true);
    expect(mock).toHaveBeenCalledWith(
      'https://bot.test/miniapp/websync-delete',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ key: ACCOUNT.key, sig: ACCOUNT.sig }) }),
    );
  });

  it('reports a failed delete', async () => {
    const { ws } = await fresh();
    fetchReturning(500);
    expect(await ws.deleteGoogleWebSync(ACCOUNT)).toBe(false);
  });

  it('pull returns null when the store is reachable but empty', async () => {
    const { ws } = await fresh();
    fetchReturning(200, { web_prefs: null });

    expect(await ws.pullFromGoogleWebSync(ACCOUNT)).toBeNull();
  });

  it('push returns false and invalidates on a 401', async () => {
    const { ws, login } = await fresh();
    const { collectSettingsBlob } = await import('./blob');
    fetchReturning(401);

    expect(await ws.pushToGoogleWebSync(ACCOUNT, collectSettingsBlob())).toBe(false);
    expect(login.loadGoogleAccount()).toBeNull();
  });

  it('push succeeds when the bot accepts it', async () => {
    const { ws } = await fresh();
    const { collectSettingsBlob } = await import('./blob');
    const mock = fetchReturning(200, { web_prefs: '{}' });

    expect(await ws.pushToGoogleWebSync(ACCOUNT, collectSettingsBlob())).toBe(true);
    expect(mock).toHaveBeenCalledWith(
      'https://bot.test/miniapp/websync',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
