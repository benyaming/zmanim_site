import { describe, expect, it } from 'vitest';

import { formatHebrewDateParts, hebrewMonthName, hebrewYearLabel } from './format';
import type { HebrewDateParts } from './types';

const adarII: HebrewDateParts = { year: 5784, month: 13, day: 14 };
const cheshvan30: HebrewDateParts = { year: 5785, month: 8, day: 30 };

describe('formatHebrewDateParts', () => {
  it('renders Hebrew script with gematria for he', () => {
    expect(formatHebrewDateParts(adarII, 'he')).toBe('י״ד אדר ב׳ תשפ״ד');
  });

  it('renders a genitive month for ru', () => {
    expect(formatHebrewDateParts(cheshvan30, 'ru')).toBe('30 Хешвана 5785');
  });

  it('renders day + month + year for en, resolving the leap-year Adar', () => {
    expect(formatHebrewDateParts(adarII, 'en')).toBe('14 Adar II 5784');
  });
});

describe('hebrewMonthName', () => {
  it('resolves Adar II by year and locale', () => {
    expect(hebrewMonthName(5784, 13, 'en')).toBe('Adar II');
    expect(hebrewMonthName(5784, 12, 'en')).toBe('Adar I');
    expect(hebrewMonthName(5785, 12, 'en')).toBe('Adar'); // non-leap: single Adar
  });
});

describe('hebrewYearLabel', () => {
  it('uses gematria for he and plain digits otherwise', () => {
    expect(hebrewYearLabel(5784, 'he')).toBe('תשפ״ד');
    expect(hebrewYearLabel(5784, 'en')).toBe('5784');
    expect(hebrewYearLabel(5784, 'ru')).toBe('5784');
  });
});
