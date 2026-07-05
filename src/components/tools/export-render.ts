'use client';

import type { ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

/**
 * Render export pages into a hidden off-screen host so they can be rasterized.
 * The host lives in the real document (styles, fonts and theme tokens apply);
 * `flushSync` forces the render to commit before we query the pages.
 */
export async function renderExportPages(node: ReactNode): Promise<{ pages: HTMLElement[]; dispose: () => void }> {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-20000px';
  host.style.top = '0';
  document.body.appendChild(host);
  const root = createRoot(host);
  flushSync(() => root.render(node));
  // Fonts must be ready before snapshotting or the raster falls back mid-family.
  await document.fonts.ready;
  return {
    pages: Array.from(host.querySelectorAll<HTMLElement>('[data-export-page]')),
    dispose: () => {
      root.unmount();
      host.remove();
    },
  };
}
