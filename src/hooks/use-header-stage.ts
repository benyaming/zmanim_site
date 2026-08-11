'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * How much of the header's optional furniture to fold away, decided by
 * measuring actual fit rather than a fixed breakpoint — so it only folds when
 * the controls genuinely don't fit (a roomy phone keeps everything). The
 * wordmark always stays.
 *
 * Stage 0 — everything shown.
 * Stage 1 — the Calendar button folds into the Settings menu.
 * Stage 2 — the Help button drops too. It stays reachable from the footer,
 *           including inside the Telegram mini app, which is why folding it is
 *           acceptable at all; the remaining controls (location, tools,
 *           settings, account) have nowhere else to live.
 *
 * Without stage 2 a ~320px phone overflows: with the location pill at its
 * 12rem cap the control row needs more width than the bar has, and the bar
 * clips — silently cutting the trailing Account button rather than the one
 * piece of furniture with a second home.
 */
const PAD = 16; // px-4 on the bar (both sides)
const GAP = 8; // gap-2 between the wordmark and the controls
const HYSTERESIS = 12; // extra room required before unfolding again, to avoid flip-flop
const MAX_STAGE = 2;

export function useHeaderStage(): {
  barRef: React.RefObject<HTMLDivElement | null>;
  foldCalendar: boolean;
  foldHelp: boolean;
} {
  const barRef = useRef<HTMLDivElement | null>(null);
  const [stage, setStage] = useState(0);
  const stageRef = useRef(0);
  // Each foldable button's width plus its gap; stable, cached while mounted so
  // the width survives the button being unmounted by its own fold.
  const widths = useRef({ cal: 44, help: 44 });

  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const measure = () => {
      const controls = bar.querySelector<HTMLElement>('[data-hdr="controls"]');
      if (!controls) return;
      const logo = bar.querySelector<HTMLElement>('[data-hdr="logo"]');
      const cal = bar.querySelector<HTMLElement>('[data-hdr="cal"]');
      const help = bar.querySelector<HTMLElement>('[data-hdr="help"]');
      if (cal) widths.current.cal = cal.offsetWidth + GAP;
      if (help) widths.current.help = help.offsetWidth + GAP;

      const avail = bar.clientWidth - PAD * 2;
      const current = stageRef.current;
      // Width the hidden buttons would add back, for any stage.
      const hidden = (s: number) => (s >= 1 ? widths.current.cal : 0) + (s >= 2 ? widths.current.help : 0);
      // controls' natural width already excludes whatever this stage folded.
      const natural = (logo?.offsetWidth ?? 0) + GAP + controls.offsetWidth + hidden(current);
      const neededAt = (s: number) => natural - hidden(s);

      let next = current;
      while (next < MAX_STAGE && avail < neededAt(next)) next++;
      while (next > 0 && avail >= neededAt(next - 1) + HYSTERESIS) next--;

      if (next !== current) {
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
  }, [stage]);

  return { barRef, foldCalendar: stage >= 1, foldHelp: stage >= 2 };
}
