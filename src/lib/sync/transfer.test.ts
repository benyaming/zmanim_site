import { beforeEach, describe, expect, it } from 'vitest';

import { PREFS_STORAGE_KEY } from '@/components/providers/app-state';
import { installMemoryLocalStorage } from '@/test/memory-storage';

import type { SettingsBlob } from './blob';
import { buildSettingsLink, decodeSettingsPayload, encodeSettingsPayload, parseSettingsFile, settingsFromHash } from './transfer';

beforeEach(() => {
  installMemoryLocalStorage();
});

const T = '2026-07-19T10:00:00.000Z';
const BLOB: SettingsBlob = {
  v: 2,
  sections: {
    // Unicode exercises the base64url text path (labels are often Hebrew/Russian).
    prefs: { data: { location: { label: 'Петах-Тиква' }, personalDates: { people: [{ name: 'בר מצווה' }] } }, t: T },
    a11y: { data: { fontScale: 'lg' }, t: T },
    theme: { data: 'system', t: T },
    language: { data: 'ru', t: T },
  },
};

describe('settings link payload', () => {
  it('roundtrips unicode content through base64url', () => {
    const payload = encodeSettingsPayload(BLOB);
    expect(payload).not.toBeNull();
    // base64url: no '+', '/', '=' that would need escaping inside a fragment.
    expect(payload!).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeSettingsPayload(payload!)).toEqual(BLOB);
  });

  it('rejects garbage payloads', () => {
    expect(decodeSettingsPayload('!!not-base64!!')).toBeNull();
    expect(decodeSettingsPayload(btoa('{"v":99}').replace(/=+$/, ''))).toBeNull();
  });

  it('builds a link whose fragment parses back to this device settings', () => {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify({ candleLightingOffset: 40 }));
    const link = buildSettingsLink();
    expect(link).not.toBeNull();
    const hash = new URL(link!).hash;
    const blob = settingsFromHash(hash);
    expect(blob?.sections.prefs.data).toEqual({ candleLightingOffset: 40 });
  });
});

describe('settingsFromHash', () => {
  it('ignores unrelated fragments (plain navigation, Telegram launch data)', () => {
    expect(settingsFromHash('')).toBeNull();
    expect(settingsFromHash('#section-2')).toBeNull();
    expect(settingsFromHash('#tgWebAppData=abc&tgWebAppPlatform=ios')).toBeNull();
  });
});

describe('parseSettingsFile', () => {
  it('accepts a pretty-printed export', () => {
    expect(parseSettingsFile(`${JSON.stringify(BLOB, null, 2)}\n`)).toEqual(BLOB);
  });

  it('rejects a file that is not a settings export', () => {
    expect(parseSettingsFile('{"some":"json"}')).toBeNull();
    expect(parseSettingsFile('not json')).toBeNull();
  });
});
