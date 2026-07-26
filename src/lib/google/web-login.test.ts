import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installMemoryLocalStorage } from '@/test/memory-storage';

type WebLoginModule = typeof import('./web-login');

const CLIENT_ID = 'client.apps.googleusercontent.com';
const BOT_BASE = 'https://bot.test/miniapp';
const KEYED = { key: 'a'.repeat(32), sig: 'b'.repeat(64), email: 'x@y.com', name: 'Rivka', picture: 'https://p/x.png' };

/** The module reads its client id and bot base from the env at load time. */
async function freshModule(clientId = CLIENT_ID, botBase = BOT_BASE): Promise<WebLoginModule> {
  vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', clientId);
  vi.stubEnv('NEXT_PUBLIC_TG_BOT_API_URL', botBase);
  vi.resetModules();
  return import('./web-login');
}

/**
 * A GIS ID stand-in: captures the callback `initialize` is given so a test can
 * fire a credential as if the user picked an account in the rendered button.
 */
function fakeGis() {
  let callback: ((response: { credential?: string }) => void) | undefined;
  const id = {
    initialize: vi.fn((config: { callback: (r: { credential?: string }) => void }) => {
      callback = config.callback;
    }),
    renderButton: vi.fn(),
    disableAutoSelect: vi.fn(),
  };
  vi.stubGlobal('google', { accounts: { id } });
  return { id, fireCredential: (credential?: string) => callback?.({ credential }) };
}

/** Bot /google-key response. */
function keyFetch(ok = true, body: unknown = KEYED) {
  const mock = vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) });
  vi.stubGlobal('fetch', mock);
  return mock;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  installMemoryLocalStorage();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('google web login', () => {
  it('is unconfigured without a client id', async () => {
    const { googleLoginConfigured } = await freshModule('');
    expect(googleLoginConfigured()).toBe(false);
  });

  it('is unconfigured without a bot API base — there is nowhere to store', async () => {
    const { googleLoginConfigured } = await freshModule(CLIENT_ID, '');
    expect(googleLoginConfigured()).toBe(false);
  });

  it('is configured with both', async () => {
    const { googleLoginConfigured } = await freshModule();
    expect(googleLoginConfigured()).toBe(true);
  });

  it('signs in: exchanges the ID token for the bot key+sig, stores it, notifies', async () => {
    const { mountGoogleSignInButton, loadGoogleAccount, googleSignedIn, GOOGLE_AUTH_EVENT } = await freshModule();
    const gis = fakeGis();
    const fetchMock = keyFetch();
    const onSignedIn = vi.fn();
    const authEvent = vi.fn();
    window.addEventListener(GOOGLE_AUTH_EVENT, authEvent);

    const container = document.createElement('div');
    mountGoogleSignInButton(container, onSignedIn);
    await tick(); // loadGsi().then → initialize + renderButton
    expect(gis.id.renderButton).toHaveBeenCalledWith(container, expect.any(Object));

    gis.fireCredential('id-token-jwt');
    await tick(); // exchange fetch resolves

    expect(fetchMock).toHaveBeenCalledWith(
      'https://bot.test/miniapp/google-key',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ credential: 'id-token-jwt' }) }),
    );
    expect(loadGoogleAccount()).toEqual(KEYED);
    expect(googleSignedIn()).toBe(true);
    expect(onSignedIn).toHaveBeenCalledWith(KEYED);
    expect(authEvent).toHaveBeenCalled();
    window.removeEventListener(GOOGLE_AUTH_EVENT, authEvent);
  });

  it('reports null (not silence) when the bot rejects the credential', async () => {
    const { mountGoogleSignInButton, googleSignedIn } = await freshModule();
    const gis = fakeGis();
    keyFetch(false, {});
    const onResult = vi.fn();

    mountGoogleSignInButton(document.createElement('div'), onResult);
    await tick();
    gis.fireCredential('id-token-jwt');
    await tick();

    expect(googleSignedIn()).toBe(false);
    expect(onResult).toHaveBeenCalledWith(null); // so the caller can show an error
  });

  it('stores nothing when the bot omits key or sig', async () => {
    const { mountGoogleSignInButton, googleSignedIn } = await freshModule();
    const gis = fakeGis();
    keyFetch(true, { email: 'x@y.com' }); // no key/sig
    mountGoogleSignInButton(document.createElement('div'), vi.fn());
    await tick();
    gis.fireCredential('id-token-jwt');
    await tick();
    expect(googleSignedIn()).toBe(false);
  });

  it('ignores an empty credential (dismissed chooser) without reporting a failure', async () => {
    const { mountGoogleSignInButton, googleSignedIn } = await freshModule();
    const gis = fakeGis();
    const fetchMock = keyFetch();
    const onResult = vi.fn();
    mountGoogleSignInButton(document.createElement('div'), onResult);
    await tick();
    gis.fireCredential(undefined);
    await tick();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(googleSignedIn()).toBe(false);
    expect(onResult).not.toHaveBeenCalled(); // a cancel is not an error — stay silent
  });

  it('refuses to sign in while a Telegram account is connected', async () => {
    // One sync account per device (engine.activeSyncTargets syncs Telegram and
    // sidelines Google). Storing a second credential would show "signed in" for
    // an account that never syncs — and the token must not reach the bot, which
    // would create a row for an account nobody is going to use.
    const { mountGoogleSignInButton, googleSignedIn } = await freshModule();
    const gis = fakeGis();
    const fetchMock = keyFetch();
    const onResult = vi.fn();
    window.localStorage.setItem(
      'zmanim:tg-web-auth:v1',
      JSON.stringify({ id: 42, auth_date: Math.floor(Date.now() / 1000), hash: 'h' }),
    );

    mountGoogleSignInButton(document.createElement('div'), onResult);
    await tick();
    gis.fireCredential('id-token-jwt');
    await tick();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(googleSignedIn()).toBe(false);
    expect(onResult).toHaveBeenCalledWith(null);
  });

  it('loads and reports a stored account', async () => {
    const { loadGoogleAccount, googleSignedIn, googleAccountDisplayName } = await freshModule();
    window.localStorage.setItem('zmanim:google-account:v2', JSON.stringify(KEYED));
    expect(googleSignedIn()).toBe(true);
    expect(loadGoogleAccount()).toEqual(KEYED);
    expect(googleAccountDisplayName(KEYED)).toBe('Rivka');
  });

  it('rejects a stored value missing the credential fields', async () => {
    const { googleSignedIn } = await freshModule();
    window.localStorage.setItem('zmanim:google-account:v2', JSON.stringify({ email: 'x@y.com' }));
    expect(googleSignedIn()).toBe(false);
  });

  it('falls back to email for the display name', async () => {
    const { googleAccountDisplayName } = await freshModule();
    expect(googleAccountDisplayName({ key: 'k', sig: 's', email: 'a@b.com' })).toBe('a@b.com');
    expect(googleAccountDisplayName({ key: 'k', sig: 's' })).toBe('');
  });

  it('signs out: drops the account, disables auto-select, notifies', async () => {
    const { signOutFromGoogle, googleSignedIn, GOOGLE_AUTH_EVENT } = await freshModule();
    const gis = fakeGis();
    window.localStorage.setItem('zmanim:google-account:v2', JSON.stringify(KEYED));
    const authEvent = vi.fn();
    window.addEventListener(GOOGLE_AUTH_EVENT, authEvent);

    signOutFromGoogle();

    expect(googleSignedIn()).toBe(false);
    expect(gis.id.disableAutoSelect).toHaveBeenCalled();
    expect(authEvent).toHaveBeenCalled();
    window.removeEventListener(GOOGLE_AUTH_EVENT, authEvent);
  });

  it('purges the Drive-era keys on any load, signed in or not', async () => {
    // The old flow is gone; nothing reads these, and one held an access token.
    // A device that used it may never sign in with Google again, so the purge
    // must not depend on a sign-out (it runs from the settings-sync provider).
    const { clearLegacyGoogleKeys } = await freshModule();
    window.localStorage.setItem('zmanim:google-token:v1', 'legacy-bearer');
    window.localStorage.setItem('zmanim:google-account:v1', '{}');
    window.localStorage.setItem('zmanim:google-sync:v1', '{}');
    window.localStorage.setItem('zmanim:google-silent-denied:v1', '1');

    clearLegacyGoogleKeys();

    for (const key of [
      'zmanim:google-token:v1',
      'zmanim:google-account:v1',
      'zmanim:google-sync:v1',
      'zmanim:google-silent-denied:v1',
    ]) {
      expect(window.localStorage.getItem(key)).toBeNull();
    }
  });

  it('does not return a stale in-memory account after a cross-tab sign-out', async () => {
    // Sign in (populates the module's in-memory copy), then simulate another
    // tab signing out by removing the shared localStorage key. This tab must
    // report signed-out — not fall through to its stale in-memory account.
    const { mountGoogleSignInButton, loadGoogleAccount } = await freshModule();
    const gis = fakeGis();
    keyFetch();
    mountGoogleSignInButton(document.createElement('div'), vi.fn());
    await tick();
    gis.fireCredential('id-token-jwt');
    await tick();
    expect(loadGoogleAccount()).toEqual(KEYED); // signed in, in memory + localStorage

    window.localStorage.removeItem('zmanim:google-account:v2'); // another tab signed out

    expect(loadGoogleAccount()).toBeNull(); // authoritative absent, not the stale memory copy
  });

  it('falls back to the in-memory account only when localStorage is unreadable', async () => {
    const { mountGoogleSignInButton, loadGoogleAccount } = await freshModule();
    const gis = fakeGis();
    keyFetch();
    mountGoogleSignInButton(document.createElement('div'), vi.fn());
    await tick();
    gis.fireCredential('id-token-jwt');
    await tick();

    // localStorage now throws on read (blocked/unavailable) — the in-memory
    // copy from this session's sign-in is the only source left.
    const realGetItem = window.localStorage.getItem;
    window.localStorage.getItem = () => {
      throw new Error('blocked');
    };
    try {
      expect(loadGoogleAccount()).toEqual(KEYED);
    } finally {
      window.localStorage.getItem = realGetItem;
    }
  });

  it('cleanup removes the rendered button', async () => {
    const { mountGoogleSignInButton } = await freshModule();
    fakeGis();
    const container = document.createElement('div');
    container.appendChild(document.createElement('span'));
    const cleanup = mountGoogleSignInButton(container, vi.fn());
    await tick();
    cleanup();
    expect(container.childNodes.length).toBe(0);
  });
});
