/**
 * Server-safe theme constants. Kept out of the client-marked theme provider:
 * a Server Component (the locale layout) interpolates `themeInitScript` into
 * the document, and values imported across the 'use client' boundary arrive
 * as client-reference stubs, not strings.
 *
 * Storage key and html classes ('light'/'dark' + color-scheme) are
 * next-themes-compatible so previously saved preferences survive.
 */

export const THEME_STORAGE_KEY = 'theme';

/** Pre-paint theme application — inline this in the document via innerHTML. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.add(d?'dark':'light');e.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
