'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * How much of the month nav fits beside the calendar title — measured, like
 * {@link useHeaderStage}, rather than guessed at a breakpoint. The nav shares
 * one wrap-aware row with the title (and, once there is room for it, the
 * calendar-system toggle), and what fits there depends on the title's own
 * width: the month name, the language (Russian's "сентябрь 2026" + "Сегодня"
 * runs ~40px wider than English) and the accessibility font scale, which turns
 * a 390px phone into a 330px one at `xl`. A fixed `sm:` breakpoint can't see
 * any of that.
 *
 * Stage 0 — both arrow pairs, "Today" spelled out.
 * Stage 1 — "Today" shrinks to its icon (~25–40px back, label kept as the
 *           accessible name).
 * Stage 2 — one arrow pair. Which one is the caller's call: on a touch device
 *           the month is swipeable, so the year jumps are the pair worth
 *           keeping; with a mouse it is the other way round.
 *
 * Below that the row simply wraps the nav onto its own line, which is the right
 * failure: a ~320px screen at the largest font scale has no arrangement that
 * fits, and losing a row of vertical space beats losing navigation.
 */
const ROW_GAP = 8; // gap-2 fallback; the row is gap-2 sm:gap-3, so measure it (see below)
const NAV_GAP = 4; // gap-1 between the nav's buttons
const ICON_BTN = 32; // size-8, the arrow buttons and the icon-only Today
const HYSTERESIS = 12; // extra room required before stepping back up, so a stage can't flip-flop
const MAX_STAGE = 2;

/** The nav's measurements, all cached so they survive their own stage hiding them. */
export interface NavDims {
  /** Width the hidden arrow pair would add back, gaps included. */
  pair: number;
  /** Width "Today" as a word costs over "Today" as an icon. */
  todayExtra: number;
}

/**
 * The richest stage that still fits, stepping one at a time from the current
 * one. Pure, so the arithmetic is testable without a layout engine.
 */
export function pickNavStage(current: number, avail: number, navWidth: number, dims: NavDims): number {
  const extra = (s: number) => (s <= 1 ? dims.pair : 0) + (s === 0 ? dims.todayExtra : 0);
  // What the nav measures now, minus whatever the current stage is showing —
  // i.e. the leanest arrangement, which every stage builds on.
  const base = navWidth - extra(current);
  const neededAt = (s: number) => base + extra(s);

  let next = current;
  while (next < MAX_STAGE && avail < neededAt(next)) next++;
  while (next > 0 && avail >= neededAt(next - 1) + HYSTERESIS) next--;
  return next;
}

export function useCalendarNavStage(): { rowRef: React.RefObject<HTMLDivElement | null>; stage: number } {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [stage, setStage] = useState(0);
  const stageRef = useRef(0);
  const dims = useRef<NavDims>({ pair: 2 * (ICON_BTN + NAV_GAP), todayExtra: 25 });

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const measure = () => {
      const nav = row.querySelector<HTMLElement>('[data-cal="nav"]');
      const title = row.querySelector<HTMLElement>('[data-cal="title"]');
      if (!nav || !title) return;
      const toggle = row.querySelector<HTMLElement>('[data-cal="toggle"]');
      const arrow = nav.querySelector<HTMLElement>('[data-cal="arrow"]');
      const today = nav.querySelector<HTMLElement>('[data-cal="today"]');
      const current = stageRef.current;

      // Re-measure what this stage happens to be showing; the rest stands from
      // the last stage that showed it (or the constants above, first time).
      const iconW = arrow?.offsetWidth || ICON_BTN;
      if (arrow) dims.current.pair = 2 * (iconW + NAV_GAP);
      if (today && current === 0) dims.current.todayExtra = today.offsetWidth - iconW;

      // The row's gap is responsive (gap-2 sm:gap-3), so read it rather than
      // mirror it: hardcoding 8 overstates avail by 4px per gap at >=sm — and
      // the step-down test carries no margin, so a nav a few px too wide would
      // be judged to fit and the row would wrap instead of shrinking "Today".
      const rowGap = parseFloat(getComputedStyle(row).columnGap) || ROW_GAP;

      // The toggle is a full-width line of its own until the row is wide enough
      // to seat it beside the title — only then does it eat into the nav's share.
      const toggleShares = toggle !== null && Math.abs(toggle.offsetTop - title.offsetTop) < 4;
      // Always the space beside the title, even when the nav has already wrapped
      // onto its own line. That looks like the wrong number to measure — the nav
      // is alone on its line, so it plainly fits — but it is the ONLY number that
      // unwraps it: the nav wraps precisely when `title + gap + nav > row`, i.e.
      // when this avail is below the nav's width, which is the step-up trigger.
      // Substituting the full row width there reports "it fits", the stage never
      // steps up, the nav never shrinks, and the hook only ratifies a wrap it
      // exists to resolve. Recovery needs no wrapped-state branch either: both
      // inputs are under the ResizeObserver, so a wider viewport or a shorter
      // month name steps the stage back down on its own.
      const avail = row.clientWidth - title.offsetWidth - rowGap - (toggleShares ? toggle.offsetWidth + rowGap : 0);

      const next = pickNavStage(current, avail, nav.offsetWidth, dims.current);
      if (next !== current) {
        stageRef.current = next;
        setStage(next);
      }
    };

    measure();
    // Web fonts change the title's width after first paint.
    if (document.fonts?.ready) void document.fonts.ready.then(measure);
    // The row for viewport changes; the title because it resizes on its own —
    // a longer month name, a language switch, or a font-scale change, none of
    // which touch the row's width.
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    const title = row.querySelector('[data-cal="title"]');
    if (title) ro.observe(title);
    return () => ro.disconnect();
  }, [stage]);

  return { rowRef, stage };
}
