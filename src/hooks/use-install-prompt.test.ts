import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type HookModule = typeof import('./use-install-prompt');

// The hook keeps module-level state (the stashed beforeinstallprompt event),
// so each test imports a fresh copy of the module.
async function freshModule(): Promise<HookModule> {
  vi.resetModules();
  return import('./use-install-prompt');
}

function fireBeforeInstallPrompt(overrides: Partial<import('./use-install-prompt').BeforeInstallPromptEvent> = {}) {
  const event = Object.assign(new Event('beforeinstallprompt'), {
    prompt: () => Promise.resolve(),
    userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
    ...overrides,
  });
  window.dispatchEvent(event);
  return event;
}

describe('useInstallPrompt', () => {
  beforeEach(() => {
    // jsdom has no matchMedia; the hook must tolerate that (isStandalone → false).
    expect(window.matchMedia).toBeUndefined();
  });

  it('starts in the manual state when no prompt event has fired', async () => {
    const { useInstallPrompt } = await freshModule();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current).toBe('manual');
  });

  it('picks up an event stashed by the inline head script before the bundle loaded', async () => {
    const stashed = Object.assign(new Event('beforeinstallprompt'), {
      prompt: () => Promise.resolve(),
      userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
    });
    (window as Window & { __zmanimBip?: Event }).__zmanimBip = stashed;
    try {
      const { useInstallPrompt } = await freshModule();
      const { result } = renderHook(() => useInstallPrompt());
      expect(result.current).toBe('available');
    } finally {
      delete (window as Window & { __zmanimBip?: Event }).__zmanimBip;
    }
  });

  it('becomes available when beforeinstallprompt fires, even before the hook mounts', async () => {
    const { useInstallPrompt } = await freshModule();
    fireBeforeInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current).toBe('available');
  });

  it('updates a mounted hook when the event fires later', async () => {
    const { useInstallPrompt } = await freshModule();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current).toBe('manual');
    act(() => {
      fireBeforeInstallPrompt();
    });
    expect(result.current).toBe('available');
  });

  it('promptInstall shows the native prompt and reports installed on acceptance', async () => {
    const { useInstallPrompt, promptInstall } = await freshModule();
    const prompt = vi.fn(() => Promise.resolve());
    act(() => {
      fireBeforeInstallPrompt({ prompt });
    });
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current).toBe('available');
    await act(() => promptInstall());
    expect(prompt).toHaveBeenCalledOnce();
    expect(result.current).toBe('installed');
  });

  it('falls back to manual when the user dismisses the prompt', async () => {
    const { useInstallPrompt, promptInstall } = await freshModule();
    act(() => {
      fireBeforeInstallPrompt({ userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }) });
    });
    const { result } = renderHook(() => useInstallPrompt());
    await act(() => promptInstall());
    expect(result.current).toBe('manual');
  });

  it('falls back to manual when prompt() rejects (event already consumed by the browser)', async () => {
    const { useInstallPrompt, promptInstall } = await freshModule();
    act(() => {
      fireBeforeInstallPrompt({ prompt: () => Promise.reject(new Error('already used')) });
    });
    const { result } = renderHook(() => useInstallPrompt());
    await act(() => promptInstall());
    expect(result.current).toBe('manual');
  });

  it('reports installed when the appinstalled event fires', async () => {
    const { useInstallPrompt } = await freshModule();
    act(() => {
      fireBeforeInstallPrompt();
    });
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(result.current).toBe('installed');
  });
});
