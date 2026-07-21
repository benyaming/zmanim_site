'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Whether to fold the Calendar button into the Settings menu, decided by
 * measuring actual fit rather than a fixed breakpoint — so it only folds when
 * the controls genuinely don't fit (a roomy phone keeps everything). The
 * wordmark always stays.
 */
const PAD = 16; // px-4 on the bar (both sides)
const GAP = 8; // gap-2 between the wordmark and the controls
const HYSTERESIS = 12; // extra room required before unfolding again, to avoid flip-flop

export function useHeaderStage(): { barRef: React.RefObject<HTMLDivElement | null>; foldCalendar: boolean } {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [foldCalendar, setFoldCalendar] = useState(false);
  const foldedRef = useRef(false);
  // Calendar button + its gap; stable, cached while the button is mounted.
  const calWidth = useRef(44);

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const measure = () => {
      const controls = bar.querySelector<HTMLElement>('[data-hdr="controls"]');
      const logo = bar.querySelector<HTMLElement>('[data-hdr="logo"]');
      if (!controls) return;
      const cal = bar.querySelector<HTMLElement>('[data-hdr="cal"]');
      if (cal) calWidth.current = cal.offsetWidth + GAP;

      const avail = bar.clientWidth - PAD * 2;
      const folded = foldedRef.current;
      // The width everything needs with the Calendar button shown. controls'
      // natural width already excludes it while folded, so add it back then.
      const needed = (logo?.offsetWidth ?? 0) + GAP + controls.offsetWidth + (folded ? calWidth.current : 0);

      let next = folded;
      if (!folded && avail < needed) next = true;
      else if (folded && avail >= needed + HYSTERESIS) next = false;

      if (next !== folded) {
        foldedRef.current = next;
        setFoldCalendar(next);
      }
    };

    measure();
    // Re-measure once web fonts settle — the wordmark width depends on them.
    if (typeof document !== 'undefined' && document.fonts?.ready) void document.fonts.ready.then(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(bar);
    return () => ro.disconnect();
  }, [foldCalendar]);

  return { barRef, foldCalendar };
}
