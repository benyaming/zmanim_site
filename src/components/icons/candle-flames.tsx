import type { SVGProps } from 'react';

/**
 * Shabbat candle-lighting glyph: a pair of candles (the customary two Shabbat
 * candles) with lit flames — reads clearly as candle lighting rather than a bare
 * flame. Bodies are stroked to match the sibling lucide event icons; the flames
 * are filled so they glow. Color comes from `currentColor` (the `text-amber-*`
 * class on the element). Accepts the same props as a lucide icon (className drives
 * the size).
 */
export function CandleFlames({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Candle holder / base */}
      <path d="M4 21h16" />
      {/* Candle bodies */}
      <rect x="6.25" y="11.5" width="4" height="9.5" rx="1" />
      <rect x="13.75" y="9.5" width="4" height="11.5" rx="1" />
      {/* Wicks */}
      <path d="M8.25 11.5v-1.2" />
      <path d="M15.75 9.5v-1.2" />
      {/* Flames (filled for a warm glow) */}
      <path
        d="M8.25 4.4c1.5 1.4 2.1 2.6 2.1 3.7a2.1 2.1 0 1 1-4.2 0c0-1.1.6-2.3 2.1-3.7Z"
        fill="currentColor"
        stroke="none"
      />
      <path
        d="M15.75 2.4c1.5 1.4 2.1 2.6 2.1 3.7a2.1 2.1 0 1 1-4.2 0c0-1.1.6-2.3 2.1-3.7Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
