import { describe, expect, it } from 'vitest';

import { nearestSettlement, searchSettlements, SETTLEMENTS, settlementName } from './settlements';

describe('SETTLEMENTS data', () => {
  it('has unique slugs and complete trilingual names', () => {
    const slugs = new Set(SETTLEMENTS.map((s) => s.slug));
    expect(slugs.size).toBe(SETTLEMENTS.length);
    for (const s of SETTLEMENTS) {
      expect(s.names.en).toBeTruthy();
      expect(s.names.he).toBeTruthy();
      expect(s.names.ru).toBeTruthy();
    }
  });

  it('keeps every settlement inside the Judea & Samaria bounding box', () => {
    for (const s of SETTLEMENTS) {
      expect(s.lat).toBeGreaterThan(31.2);
      expect(s.lat).toBeLessThan(32.6);
      expect(s.lng).toBeGreaterThan(34.85);
      expect(s.lng).toBeLessThan(35.6);
    }
  });
});

describe('searchSettlements', () => {
  const first = (q: string) => searchSettlements(q)[0]?.slug;

  it('finds the spellings the external geocoder misses', () => {
    expect(first('Modiin Illit')).toBe('modiin-illit');
    expect(first("Modi'in Illit")).toBe('modiin-illit');
    expect(first('Beitar Illit')).toBe('beitar-illit');
    expect(first('Kedumim')).toBe('kedumim');
    expect(first('Karnei Shomron')).toBe('karnei-shomron');
    expect(first('Psagot')).toBe('psagot');
  });

  it('matches Hebrew and Russian names', () => {
    expect(first('ביתר עילית')).toBe('beitar-illit');
    expect(first('מודיעין עילית')).toBe('modiin-illit');
    expect(first('Маале-Адумим')).toBe('maale-adumim');
    expect(first('ариэль')).toBe('ariel');
  });

  it('matches aliases and alternate transliterations', () => {
    expect(first('Kiryat Sefer')).toBe('modiin-illit');
    expect(first('Betar Illit')).toBe('beitar-illit');
    expect(first('Neve Tzuf')).toBe('halamish');
    expect(first('Tel Zion')).toBe('kochav-yaakov');
  });

  it('matches a prefix of an inner word', () => {
    const slugs = searchSettlements('Adumim').map((s) => s.slug);
    expect(slugs).toContain('maale-adumim');
    expect(slugs).toContain('kfar-adumim');
  });

  it('ranks full-name prefix matches above inner-word matches', () => {
    // "Ma..." should surface Ma'ale-* names before anything matching a later word.
    expect(searchSettlements('maale a')[0]?.slug).toBe('maale-adumim');
  });

  it('returns nothing for short or unrelated queries', () => {
    expect(searchSettlements('a')).toEqual([]);
    expect(searchSettlements('brooklyn')).toEqual([]);
  });
});

describe('nearestSettlement', () => {
  it('resolves coordinates inside a settlement', () => {
    expect(nearestSettlement(31.8987, 35.2241, 3)?.slug).toBe('psagot');
    expect(nearestSettlement(32.1061, 35.1851, 3)?.slug).toBe('ariel');
  });

  it('returns null away from any settlement', () => {
    expect(nearestSettlement(32.0853, 34.7818, 3)).toBeNull(); // Tel Aviv
    expect(nearestSettlement(31.771, 35.217, 3)).toBeNull(); // central Jerusalem
  });
});

describe('settlementName', () => {
  it('localizes and falls back to English', () => {
    const s = SETTLEMENTS.find((x) => x.slug === 'maale-adumim')!;
    expect(settlementName(s, 'he')).toBe('מעלה אדומים');
    expect(settlementName(s, 'ru')).toBe('Маале-Адумим');
    expect(settlementName(s, 'fr')).toBe("Ma'ale Adumim");
  });
});
