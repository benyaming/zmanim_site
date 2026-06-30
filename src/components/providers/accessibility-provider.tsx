'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type FontScale = 'default' | 'lg' | 'xl' | 'xxl';

interface AccessibilityValue {
  fontScale: FontScale;
  setFontScale: (s: FontScale) => void;
  reduceMotion: boolean;
  setReduceMotion: (v: boolean) => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
}

const AccessibilityContext = createContext<AccessibilityValue | null>(null);

export const A11Y_STORAGE_KEY = 'zmanim:a11y:v1';

interface Persisted {
  fontScale?: FontScale;
  reduceMotion?: boolean;
  highContrast?: boolean;
}

function loadPrefs(): Persisted {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(A11Y_STORAGE_KEY) ?? '{}') as Persisted;
  } catch {
    return {};
  }
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  // Read once on the client (matches the no-flash inline script in the layout).
  const [fontScale, setFontScale] = useState<FontScale>(() => loadPrefs().fontScale ?? 'default');
  const [reduceMotion, setReduceMotion] = useState<boolean>(() => loadPrefs().reduceMotion ?? false);
  const [highContrast, setHighContrast] = useState<boolean>(() => loadPrefs().highContrast ?? false);

  useEffect(() => {
    const el = document.documentElement;
    el.classList.remove('text-scale-lg', 'text-scale-xl', 'text-scale-xxl');
    if (fontScale !== 'default') el.classList.add(`text-scale-${fontScale}`);
    el.classList.toggle('reduce-motion', reduceMotion);
    el.classList.toggle('high-contrast', highContrast);
    try {
      window.localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify({ fontScale, reduceMotion, highContrast }));
    } catch {
      // ignore storage errors
    }
  }, [fontScale, reduceMotion, highContrast]);

  const value: AccessibilityValue = {
    fontScale,
    setFontScale,
    reduceMotion,
    setReduceMotion,
    highContrast,
    setHighContrast,
  };

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibility(): AccessibilityValue {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error('useAccessibility must be used within AccessibilityProvider');
  return ctx;
}
