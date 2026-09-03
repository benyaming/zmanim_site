import { describe, expect, it } from 'vitest';

import { pickNavStage, type NavDims } from './use-calendar-nav-stage';

// Measured in the browser (Russian, the widest labels): three 32px buttons with
// 4px gaps is the leanest nav at 104px, the hidden arrow pair adds 72, and the
// word "Сегодня" costs 42 over its icon.
const DIMS: NavDims = { pair: 72, todayExtra: 42 };
const LEAN = 104;
const RICH = LEAN + DIMS.pair + DIMS.todayExtra; // 218 — both pairs, Today spelled out

describe('pickNavStage', () => {
  it('stays at the richest stage while it fits', () => {
    expect(pickNavStage(0, 260, RICH, DIMS)).toBe(0);
  });

  it('drops the Today label before it drops an arrow pair', () => {
    expect(pickNavStage(0, 200, RICH, DIMS)).toBe(1);
  });

  it('drops an arrow pair when the icon alone is not enough', () => {
    expect(pickNavStage(0, 150, RICH, DIMS)).toBe(2);
  });

  it('bottoms out at the lean nav rather than removing navigation', () => {
    expect(pickNavStage(2, 10, LEAN, DIMS)).toBe(2);
  });

  it('steps back up once the room is genuinely there', () => {
    expect(pickNavStage(2, 260, LEAN, DIMS)).toBe(0);
    expect(pickNavStage(2, 190, LEAN, DIMS)).toBe(1);
  });

  it('needs more room to step up than it took to step down (no flip-flop)', () => {
    // Exactly the width stage 1 occupies: enough to stay, not enough to restore.
    const stage1Width = LEAN + DIMS.pair;
    expect(pickNavStage(1, stage1Width, stage1Width, DIMS)).toBe(1);
    // One pixel under and it gives up the pair; a hair over and it still waits
    // for the hysteresis margin before spelling Today back out.
    expect(pickNavStage(1, stage1Width - 1, stage1Width, DIMS)).toBe(2);
    expect(pickNavStage(1, RICH + 6, stage1Width, DIMS)).toBe(1);
    expect(pickNavStage(1, RICH + 12, stage1Width, DIMS)).toBe(0);
  });
});
