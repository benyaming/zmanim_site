import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCoarsePointer } from './use-coarse-pointer';

function stubMatchMedia(matches: boolean) {
  const mql = { matches, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', vi.fn(() => mql));
  return mql;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useCoarsePointer', () => {
  it('is false where matchMedia is unavailable (jsdom, old webviews)', () => {
    expect(window.matchMedia).toBeUndefined();
    expect(renderHook(() => useCoarsePointer()).result.current).toBe(false);
  });

  it('reports the primary pointer and subscribes to changes', () => {
    const mql = stubMatchMedia(true);
    const { result, unmount } = renderHook(() => useCoarsePointer());
    expect(result.current).toBe(true);
    // The *primary* pointer. `any-pointer` would also match a mouse-driven
    // touchscreen laptop, which is exactly the device the hook exists to keep
    // on the desktop controls.
    expect(window.matchMedia).toHaveBeenCalledWith('(pointer: coarse)');
    expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalled();
  });

  it('is false for a fine pointer', () => {
    stubMatchMedia(false);
    expect(renderHook(() => useCoarsePointer()).result.current).toBe(false);
  });
});
