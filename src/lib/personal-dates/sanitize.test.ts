import { describe, expect, it } from 'vitest';

import { MAX_HEBREW_YEAR, MIN_HEBREW_YEAR, newId, sanitizePersonalDates } from './sanitize';
import { MAX_EVENTS_PER_PERSON, MAX_PEOPLE, type Person, type StandaloneDate } from './types';

const person = (over: Partial<Person> = {}): Person => ({
  id: 'p1',
  name: 'Zayde',
  events: [{ id: 'e1', kind: 'death', anchor: { hebrew: { year: 5784, month: 12, day: 14 } } }],
  ...over,
});

const occasion = (over: Partial<StandaloneDate> = {}): StandaloneDate => ({
  id: 'o1',
  kind: 'wedding',
  label: 'Wedding',
  anchor: { hebrew: { year: 5760, month: 4, day: 22 } },
  ...over,
});

describe('newId', () => {
  it('generates unique ids', () => {
    expect(newId()).not.toBe(newId());
  });

  it('falls back when crypto.randomUUID is unavailable (insecure context, old Safari)', () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
    try {
      const a = newId();
      const b = newId();
      expect(a).toBeTruthy();
      expect(a).not.toBe(b);
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true });
    }
  });
});

describe('sanitizePersonalDates', () => {
  it('keeps valid people and occasions, preserving optional anchor fields', () => {
    const p = person({
      gender: 'male',
      events: [
        {
          id: 'e1',
          kind: 'death',
          anchor: { hebrew: { year: 5784, month: 12, day: 14 }, afterSunset: true, adarBehavior: 'adar2' },
          burial: { hebrew: { year: 5784, month: 12, day: 16 } },
        },
      ],
    });
    const out = sanitizePersonalDates({ people: [p], occasions: [occasion()] });
    expect(out.people).toEqual([p]);
    expect(out.occasions).toEqual([occasion()]);
  });

  it('returns empty structure for non-objects and non-array members', () => {
    expect(sanitizePersonalDates(null)).toEqual({ people: [], occasions: [] });
    expect(sanitizePersonalDates('nope')).toEqual({ people: [], occasions: [] });
    expect(sanitizePersonalDates({ people: 'x', occasions: 3 })).toEqual({ people: [], occasions: [] });
  });

  it('drops people with a missing/duplicate id or non-string name', () => {
    expect(sanitizePersonalDates({ people: [person({ id: '' })] }).people).toEqual([]);
    expect(sanitizePersonalDates({ people: [person({ name: 42 as never })] }).people).toEqual([]);
    const dup = sanitizePersonalDates({ people: [person(), person({ name: 'Other' })] });
    expect(dup.people).toHaveLength(1);
  });

  it('drops events with an unknown kind or an arithmetically impossible Hebrew anchor', () => {
    expect(sanitizePersonalDates({ people: [person({ events: [{ id: 'e', kind: 'nope' as never, anchor: { hebrew: { year: 5784, month: 1, day: 1 } } }] })] }).people[0].events).toEqual([]);
    // Month 13 in a non-leap year (5785).
    expect(sanitizePersonalDates({ people: [person({ events: [{ id: 'e', kind: 'birth', anchor: { hebrew: { year: 5785, month: 13, day: 1 } } }] })] }).people[0].events).toEqual([]);
    // Out-of-range year.
    expect(sanitizePersonalDates({ people: [person({ events: [{ id: 'e', kind: 'birth', anchor: { hebrew: { year: MIN_HEBREW_YEAR - 1, month: 1, day: 1 } } }] })] }).people[0].events).toEqual([]);
    expect(sanitizePersonalDates({ people: [person({ events: [{ id: 'e', kind: 'birth', anchor: { hebrew: { year: MAX_HEBREW_YEAR + 1, month: 1, day: 1 } } }] })] }).people[0].events).toEqual([]);
  });

  it('strips invalid gender and non-death burial rather than dropping the person', () => {
    const out = sanitizePersonalDates({
      people: [person({ gender: 'other' as never, events: [{ id: 'e', kind: 'birth', anchor: { hebrew: { year: 5784, month: 1, day: 1 } }, burial: { hebrew: { year: 5784, month: 1, day: 8 } } }] })],
    });
    expect(out.people[0].gender).toBeUndefined();
    expect(out.people[0].events[0].burial).toBeUndefined(); // burial only kept on death events
  });

  it('keeps at most one birth and one death per person, but repeats other kinds', () => {
    const out = sanitizePersonalDates({
      people: [
        person({
          events: [
            { id: 'b1', kind: 'birth', anchor: { hebrew: { year: 5770, month: 1, day: 1 } } },
            { id: 'b2', kind: 'birth', anchor: { hebrew: { year: 5771, month: 1, day: 1 } } },
            { id: 'd1', kind: 'death', anchor: { hebrew: { year: 5780, month: 1, day: 1 } } },
            { id: 'd2', kind: 'death', anchor: { hebrew: { year: 5781, month: 1, day: 1 } } },
            { id: 'w1', kind: 'wedding', anchor: { hebrew: { year: 5775, month: 1, day: 1 } } },
            { id: 'w2', kind: 'wedding', anchor: { hebrew: { year: 5776, month: 1, day: 1 } } },
          ],
        }),
      ],
    });
    const kinds = out.people[0].events.map((e) => e.kind);
    expect(kinds.filter((k) => k === 'birth')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'death')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'wedding')).toHaveLength(2);
    // The first of each singleton kind is the one kept.
    expect(out.people[0].events.find((e) => e.kind === 'birth')?.id).toBe('b1');
    expect(out.people[0].events.find((e) => e.kind === 'death')?.id).toBe('d1');
  });

  it('caps people and events', () => {
    const many = Array.from({ length: MAX_PEOPLE + 5 }, (_, i) => person({ id: `p-${i}` }));
    expect(sanitizePersonalDates({ people: many }).people).toHaveLength(MAX_PEOPLE);
    const manyEvents = Array.from({ length: MAX_EVENTS_PER_PERSON + 5 }, (_, i) => ({
      id: `e-${i}`,
      kind: 'wedding' as const,
      anchor: { hebrew: { year: 5784, month: 1, day: 1 } },
    }));
    expect(sanitizePersonalDates({ people: [person({ events: manyEvents })] }).people[0].events).toHaveLength(MAX_EVENTS_PER_PERSON);
  });
});
