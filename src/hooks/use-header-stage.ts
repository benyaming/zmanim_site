'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * How much of the header fits, most → least room:
 *   0  full     — wordmark + every control
 *   1  buttons  — wordmark dropped, all controls still shown
 *   2  compact  — wordmark dropped and the Calendar button folded into Settings
 *
 * The stage is chosen by measuring, not by a fixed breakpoint, so it only
 * compacts when the controls genuinely don't fit (a roomy phone stays full).
 */
export type HeaderStage = 0 | 1 | 2;

const PAD = 16; // px-4 on the bar (both sides)
const GAP = 8; // gap-2 between the wordmark and the controls
const HYSTERESIS = 12; // extra room required before expanding again, to avoid flip-flop

export function useHeaderStage(): { barRef: React.RefObject<HTMLDivElement | null>; stage: HeaderStage } {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [stage, setStage] = useState<HeaderStage>(0);
  const stageRef = useRef<HeaderStage>(0);
  // Widths of the two droppable pieces, cached while they're mounted (they're
  // stable, and can't be measured once hidden).
  const logoWidth = useRef(0);
  const calWidth = useRef(44); // Calendar button + its gap; refined once measured

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const measure = () => {
      const controls = bar.querySelector<HTMLElement>('[data-hdr="controls"]');
      if (!controls) return;
      const logo = bar.querySelector<HTMLElement>('[data-hdr="logo"]');
      if (logo) logoWidth.current = logo.offsetWidth;
      const cal = bar.querySelector<HTMLElement>('[data-hdr="cal"]');
      if (cal) calWidth.current = cal.offsetWidth + GAP;

      const avail = bar.clientWidth - PAD * 2;
      const s = stageRef.current;
      // controls.offsetWidth is the natural width (the pill no longer shrinks);
      // it already excludes the Calendar button once it's folded (stage 2).
      const base = controls.offsetWidth - (s < 2 ? calWidth.current : 0);
      const wButtons = base + calWidth.current; // stage 1: controls, no wordmark
      const wFull = wButtons + logoWidth.current + GAP; // stage 0

      let next: HeaderStage = s;
      if (s === 0 && avail < wFull) next = 1;
      else if (s === 1 && avail < wButtons) next = 2;
      else if (s === 2 && avail >= wButtons + HYSTERESIS) next = 1;
      else if (s === 1 && avail >= wFull + HYSTERESIS) next = 0;

      if (next !== s) {
        stageRef.current = next;
        setStage(next);
      }
    };

    measure();
    // Re-measure once web fonts settle — the wordmark width depends on them.
    if (typeof document !== 'undefined' && document.fonts?.ready) void document.fonts.ready.then(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(bar);
    return () => ro.disconnect();
    // Re-runs on each stage change so the measure can settle in more than one
    // step (e.g. drop the wordmark, then fold Calendar) before paint.
  }, [stage]);

  return { barRef, stage };
}
