'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { markUserEdit } from '@/lib/sync/blob';
import { THEME_STORAGE_KEY as STORAGE_KEY } from '@/lib/theme';

/**
 * Minimal light/dark/system theme provider (replaces next-themes).
 *
 * next-themes renders its pre-paint init as a React <script> element; this
 * app's [locale] layout remounts on every language switch, and React warns
 * about (and never executes) client-rendered script tags. Here the pre-paint
 * script lives in the layout inside a parser-executed innerHTML block (see
 * `themeInitScript` in src/lib/theme.ts — a server-safe module, since strings
 * exported from a 'use client' module reach Server Components as client-
 * reference stubs), and the provider itself only manages state + classes.
 */

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  try {
    const t = window.localStorage.getItem(STORAGE_KEY);
    return t === 'light' || t === 'dark' || t === 'system' ? t : 'system';
  } catch {
    return 'system';
  }
}

/** Swap the html classes without a transition flash on themed properties. */
function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const css = document.createElement('style');
  css.appendChild(
    document.createTextNode('*,*::before,*::after{transition:none!important;animation:none!important}'),
  );
  document.head.appendChild(css);

  const el = document.documentElement;
  el.classList.toggle('dark', dark);
  el.classList.toggle('light', !dark);
  el.style.colorScheme = dark ? 'dark' : 'light';

  window.getComputedStyle(document.body); // flush before re-enabling transitions
  setTimeout(() => document.head.removeChild(css), 1);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // Ignore storage errors (private mode, quota, etc.).
    }
    // A theme pick is always a deliberate change — mark it dirty so the next
    // sync re-stamps it above whatever the other device holds and it wins,
    // independent of location/prefs churn or clock skew.
    markUserEdit('theme');
  };

  // Apply on mount (idempotent after the pre-paint script) and on change;
  // while in system mode, follow the OS setting live.
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  // Follow theme changes made in another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setThemeState(readStoredTheme());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // The React Compiler memoizes this provider value automatically.
  const value: ThemeContextValue = { theme, setTheme };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
