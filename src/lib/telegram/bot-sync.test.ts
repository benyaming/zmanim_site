import { afterEach, describe, expect, it, vi } from 'vitest';

type BotSyncModule = typeof import('./bot-sync');

// The module reads its API base from the env at load time.
async function freshModule(apiUrl?: string): Promise<BotSyncModule> {
  if (apiUrl !== undefined) vi.stubEnv('NEXT_PUBLIC_TG_BOT_API_URL', apiUrl);
  vi.resetModules();
  return import('./bot-sync');
}

const PROFILE = {
  language: 'ru',
  cl_offset: 22,
  havdala_opinion: 'tzeis_42_minutes',
  location: { lat: 32.08, lng: 34.78, name: 'Тель-Авив', elevation: 20 },
  locations: [
    { lat: 32.08, lng: 34.78, name: 'Тель-Авив', elevation: 20 },
    { lat: 31.77, lng: 35.21, name: 'Иерусалим', elevation: 754 },
    { lat: 'bad', lng: 1 }, // malformed entries are dropped, not fatal
  ],
};

function okFetch(json: unknown = PROFILE) {
  const mock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(json) });
  vi.stubGlobal('fetch', mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('bot-sync', () => {
  it('is disabled without NEXT_PUBLIC_TG_BOT_API_URL and never calls fetch', async () => {
    const { botSyncEnabled, fetchBotProfile } = await freshModule('');
    const mock = okFetch();
    expect(botSyncEnabled()).toBe(false);
    expect(await fetchBotProfile('data')).toBeNull();
    expect(mock).not.toHaveBeenCalled();
  });

  it('fetches and parses the profile (snake_case → camelCase, trailing slash trimmed)', async () => {
    const { fetchBotProfile } = await freshModule('https://bot.test/zmanim_bot/miniapp/');
    const mock = okFetch();

    const profile = await fetchBotProfile('init-data');
    expect(mock).toHaveBeenCalledWith(
      'https://bot.test/zmanim_bot/miniapp/me',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ init_data: 'init-data' }) }),
    );
    expect(profile).toEqual({
      language: 'ru',
      clOffset: 22,
      havdalaOpinion: 'tzeis_42_minutes',
      location: { lat: 32.08, lng: 34.78, name: 'Тель-Авив', elevation: 20 },
      locations: [
        { lat: 32.08, lng: 34.78, name: 'Тель-Авив', elevation: 20 },
        { lat: 31.77, lng: 35.21, name: 'Иерусалим', elevation: 754 },
      ],
      webPrefs: null,
    });
  });

  it('authenticates with a Login Widget payload and carries the settings blob both ways', async () => {
    const { fetchBotProfile, pushBotSync } = await freshModule('https://bot.test/api');
    const blob = JSON.stringify({ v: 1, updatedAt: '2026-07-19T10:00:00.000Z' });
    let mock = okFetch({ ...PROFILE, web_prefs: blob });

    const authData = { id: 42, first_name: 'B', auth_date: 1770000000, hash: 'h' };
    const profile = await fetchBotProfile({ authData });
    expect(JSON.parse((mock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ auth_data: authData });
    expect(profile?.webPrefs).toBe(blob);

    mock = okFetch();
    await pushBotSync({ authData }, { webPrefs: blob });
    expect(JSON.parse((mock.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      auth_data: authData,
      web_prefs: blob,
    });
  });

  it('drops a malformed location but keeps the rest of the profile', async () => {
    const { fetchBotProfile } = await freshModule('https://bot.test/api');
    okFetch({ ...PROFILE, location: { lat: 'oops', lng: 34.78 }, locations: 'nonsense' });
    const profile = await fetchBotProfile('d');
    expect(profile?.location).toBeNull();
    expect(profile?.locations).toEqual([]);
    expect(profile?.clOffset).toBe(22);
  });

  it('returns null on HTTP errors and network failures', async () => {
    const { fetchBotProfile } = await freshModule('https://bot.test/api');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    expect(await fetchBotProfile('d')).toBeNull();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    expect(await fetchBotProfile('d')).toBeNull();
  });

  it('sends an export file as preflight-free multipart form data', async () => {
    const { sendExportToBot } = await freshModule('https://bot.test/api');
    const mock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mock);

    const ok = await sendExportToBot('init-data', new Blob(['a,b'], { type: 'text/csv' }), 'zmanim.csv');
    expect(ok).toBe(true);
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://bot.test/api/export');
    const form = init.body as FormData;
    expect(form.get('init_data')).toBe('init-data');
    expect((form.get('file') as File).name).toBe('zmanim.csv');
  });

  it('pushes a patch with bot-side field names and a rounded elevation', async () => {
    const { pushBotSync } = await freshModule('https://bot.test/api');
    const mock = okFetch();

    const profile = await pushBotSync('init-data', {
      location: { lat: 1.5, lng: 2.5, name: 'Somewhere', elevation: 12.7 },
      clOffset: 30,
      havdalaOpinion: 'tzeis_72_minutes',
    });
    expect(mock).toHaveBeenCalledWith('https://bot.test/api/sync', expect.anything());
    const body = JSON.parse((mock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({
      init_data: 'init-data',
      location: { lat: 1.5, lng: 2.5, name: 'Somewhere', elevation: 13 },
      cl_offset: 30,
      havdala_opinion: 'tzeis_72_minutes',
    });
    expect(profile?.clOffset).toBe(22); // server response wins as the new baseline
  });
});
