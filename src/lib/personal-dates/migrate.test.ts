import { describe, expect, it } from 'vitest';

import { migrateLegacyCustomDates } from './migrate';

const legacy = (kind: string, over: Record<string, unknown> = {}) => ({
  id: `${kind}-1`,
  kind,
  label: 'Grandpa',
  hebrew: { year: 5760, month: 4, day: 22 },
  ...over,
});

describe('migrateLegacyCustomDates', () => {
  it('turns a birthday into a person with a birth event (gender unset)', () => {
    const { people } = migrateLegacyCustomDates([legacy('birthday')]);
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({ id: 'birthday-1', name: 'Grandpa', gender: undefined });
    expect(people[0].events[0]).toMatchObject({ kind: 'birth', anchor: { hebrew: { year: 5760, month: 4, day: 22 } } });
  });

  it('turns bar/bat mitzvah into a gendered birth event, dropping any stored Adar choice', () => {
    const bar = migrateLegacyCustomDates([legacy('barMitzvah', { adarBehavior: 'adar1' })]).people[0];
    expect(bar.gender).toBe('male');
    expect(bar.events[0].kind).toBe('birth');
    expect(bar.events[0].anchor.adarBehavior).toBeUndefined();

    const bat = migrateLegacyCustomDates([legacy('batMitzvah')]).people[0];
    expect(bat.gender).toBe('female');
    expect(bat.events[0].kind).toBe('birth');
  });

  it('turns a yahrzeit into a death event, preserving afterSunset and the Adar choice', () => {
    const p = migrateLegacyCustomDates([legacy('yahrzeit', { afterSunset: true, adarBehavior: 'adar2' })]).people[0];
    expect(p.events[0]).toMatchObject({
      kind: 'death',
      anchor: { hebrew: { year: 5760, month: 4, day: 22 }, afterSunset: true, adarBehavior: 'adar2' },
    });
  });

  it('drops malformed entries and non-arrays', () => {
    expect(migrateLegacyCustomDates(null)).toEqual({ people: [], occasions: [] });
    expect(migrateLegacyCustomDates([{ kind: 'nope' }, 1, null]).people).toEqual([]);
    // Impossible Hebrew date is rejected by the re-validation pass.
    expect(migrateLegacyCustomDates([legacy('birthday', { hebrew: { year: 5785, month: 13, day: 1 } })]).people).toEqual([]);
  });
});
