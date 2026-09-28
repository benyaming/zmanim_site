import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

import { type AnchorDate, observancesOn, partsFromDay, type PersonalDatesData } from '@/lib/personal-dates';

import { reportTranslator } from './export-i18n';
import { observanceChipText } from './personal-dates-labels';

const anchor: AnchorDate = { hebrew: partsFromDay(DateTime.fromISO('2015-03-10')) };

const DATA: PersonalDatesData = {
  people: [
    {
      id: 'p1',
      name: 'Dana',
      events: [
        { id: 'w1', kind: 'wedding', anchor },
        { id: 'c1', kind: 'custom', label: 'Aliyah', anchor },
        { id: 'c2', kind: 'custom', label: 'Graduation', anchor },
        { id: 'c3', kind: 'custom', anchor },
      ],
    },
  ],
  occasions: [
    { id: 'o1', kind: 'wedding', label: 'Our wedding', anchor },
    { id: 'o2', kind: 'custom', label: 'Adoption day', anchor },
    { id: 'o3', kind: 'anniversary', label: 'Shop opened', anchor },
  ],
};

/** Chip text per anchor event on a day, civil anniversaries only. */
function chips(iso: string, locale: string): Record<string, string> {
  const tr = reportTranslator(locale);
  const t = (key: string, values?: Record<string, string | number>) => tr(`personalDates.${key}`, values);
  const out: Record<string, string> = {};
  for (const obs of observancesOn(DateTime.fromISO(iso), DATA)) {
    if (obs.kind === 'civilAnniversary') out[obs.eventId] = observanceChipText(obs, t);
  }
  return out;
}

describe('observanceChipText — anniversaries', () => {
  it('names a custom date on its own day, and "married" only for a wedding', () => {
    expect(chips('2015-03-10', 'en')).toEqual({
      w1: 'Dana · married',
      c1: 'Dana · Aliyah',
      c2: 'Dana · Graduation',
      c3: 'Dana · Other date',
      o1: 'Our wedding · married',
      o2: 'Adoption day',
      o3: 'Shop opened',
    });
  });

  it('keeps each custom date apart on its anniversaries', () => {
    expect(chips('2026-03-10', 'en')).toEqual({
      w1: 'Dana · 11th anniversary · civil',
      c1: 'Dana · Aliyah · 11th anniversary · civil',
      c2: 'Dana · Graduation · 11th anniversary · civil',
      c3: 'Dana · Other date · 11th anniversary · civil',
      o1: 'Our wedding · 11th anniversary · civil',
      o2: 'Adoption day · 11th anniversary · civil',
      o3: 'Shop opened · 11th anniversary · civil',
    });
  });

  it('reads the same way in Hebrew and Russian', () => {
    const he = chips('2026-03-10', 'he');
    expect(he.c1).toBe('Dana · Aliyah · יום השנה ה־11 · לועזי');
    expect(he.c3).toBe('Dana · תאריך אחר · יום השנה ה־11 · לועזי');
    const ru = chips('2015-03-10', 'ru');
    expect(ru.c1).toBe('Dana · Aliyah');
    expect(ru.w1).toBe('Dana · свадьба');
    expect(chips('2026-03-10', 'ru').c2).toBe('Dana · Graduation · 11-я годовщина · гражд.');
  });
});
