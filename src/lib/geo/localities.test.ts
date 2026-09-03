import { describe, expect, it } from 'vitest';

import { DEFAULT_CLAIM_KM, haversineKm, LOCALITIES, localityName, nearestLocality, searchLocalities } from './localities';

describe('LOCALITIES data', () => {
  it('has unique slugs and complete trilingual names', () => {
    const slugs = new Set(LOCALITIES.map((l) => l.slug));
    expect(slugs.size).toBe(LOCALITIES.length);
    for (const l of LOCALITIES) {
      expect(l.names.en).toBeTruthy();
      expect(l.names.he).toBeTruthy();
      expect(l.names.ru).toBeTruthy();
    }
  });

  it('keeps every locality inside an Israel-wide bounding box', () => {
    for (const l of LOCALITIES) {
      expect(l.lat).toBeGreaterThan(29.4);
      expect(l.lat).toBeLessThan(33.4);
      expect(l.lng).toBeGreaterThan(34.2);
      expect(l.lng).toBeLessThan(35.9);
    }
  });

  it('keeps every bounds box well-formed and around its own center', () => {
    for (const l of LOCALITIES.filter((x) => x.bounds)) {
      const [south, north, west, east] = l.bounds!;
      expect(south).toBeLessThan(north);
      expect(west).toBeLessThan(east);
      expect(l.lat).toBeGreaterThanOrEqual(south);
      expect(l.lat).toBeLessThanOrEqual(north);
      expect(l.lng).toBeGreaterThanOrEqual(west);
      expect(l.lng).toBeLessThanOrEqual(east);
    }
  });

  it('gives every claiming locality its own center, so no two share coordinates', () => {
    // An entry cannot lose its own center to a neighbour's reach: nearestLocality
    // ranks claimants by distance and an entry is 0km from itself, the global
    // minimum. What this does catch is two entries at the same coordinates —
    // then the strict `d < bestKm` tie keeps whichever comes first in the file
    // and the other is unreachable by name at its own spot, which is a data
    // error. Overlap resolution proper is the `einat` case below.
    const claiming = LOCALITIES.filter((l) => l.bounds || (l.radiusKm ?? DEFAULT_CLAIM_KM) > 0);
    for (const l of claiming) {
      expect(nearestLocality(l.lat, l.lng)?.slug).toBe(l.slug);
    }
  });
});

describe('searchLocalities', () => {
  const first = (q: string) => searchLocalities(q)[0]?.slug;

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
    const slugs = searchLocalities('Adumim').map((l) => l.slug);
    expect(slugs).toContain('maale-adumim');
    expect(slugs).toContain('kfar-adumim');
  });

  it('ranks full-name prefix matches above inner-word matches', () => {
    // "Ma..." should surface Ma'ale-* names before anything matching a later word.
    expect(searchLocalities('maale a')[0]?.slug).toBe('maale-adumim');
  });

  it('returns nothing for short or unrelated queries', () => {
    expect(searchLocalities('a')).toEqual([]);
    expect(searchLocalities('brooklyn')).toEqual([]);
  });

  it('finds Israeli cities that Open-Meteo has no Hebrew entry for', () => {
    // Each of these returns zero results from the remote geocoder when queried
    // in Hebrew, so the bundled index is the only way to reach them.
    expect(first('ראש העין')).toBe('rosh-haayin');
    expect(first('אלעד')).toBe('elad');
    expect(first('נהריה')).toBe('nahariya');
    expect(first('רהט')).toBe('rahat');
    expect(first('טלזסטון')).toBe('telz-stone');
    expect(first('אום אל-פחם')).toBe('umm-al-fahm');
  });

  it('finds Rosh HaAyin in every language, however the apostrophe is typed', () => {
    expect(first('Rosh HaAyin')).toBe('rosh-haayin');
    expect(first("Rosh Ha'Ayin")).toBe('rosh-haayin');
    expect(first('rosh haayin')).toBe('rosh-haayin');
    expect(first('Рош-ха-Аин')).toBe('rosh-haayin');
    expect(first('ראש העין')).toBe('rosh-haayin');
  });

  it('folds כתיב מלא onto כתיב חסר in both directions', () => {
    // Whichever spelling the entry stores, either one the user types must hit.
    expect(first('קריית ארבע')).toBe('kiryat-arba');
    expect(first('קרית ארבע')).toBe('kiryat-arba');
    expect(first('קרית ספר')).toBe('modiin-illit');
    expect(first('קריית ספר')).toBe('modiin-illit');
    expect(first('קריית גת')).toBe('kiryat-gat');
    expect(first('קרית גת')).toBe('kiryat-gat');
    expect(first('נווה דניאל')).toBe('neve-daniel');
    expect(first('נוה דניאל')).toBe('neve-daniel');
  });
});

describe('nearestLocality', () => {
  it('resolves coordinates inside a locality', () => {
    expect(nearestLocality(31.8987, 35.2241)?.slug).toBe('psagot');
    expect(nearestLocality(32.1061, 35.1851)?.slug).toBe('ariel');
  });

  it('returns null away from any locality', () => {
    expect(nearestLocality(32.0853, 34.7818)).toBeNull(); // Tel Aviv
    expect(nearestLocality(31.771, 35.217)).toBeNull(); // central Jerusalem
  });

  it('covers eastern Rosh HaAyin, where BigDataCloud answers "Salfit"', () => {
    // BigDataCloud's Salfit governorate polygon starts ~2.2 km east of the city
    // center and returns "Salfit" as the *city* field, so the app displayed a
    // town 21 km away. The claim radius has to reach past that boundary.
    expect(nearestLocality(32.0956, 34.9566)?.slug).toBe('rosh-haayin'); // center
    expect(nearestLocality(32.0956, 34.98)?.slug).toBe('rosh-haayin'); // first mislabeled point
    expect(nearestLocality(32.0956, 34.99)?.slug).toBe('rosh-haayin'); // eastern edge
    expect(haversineKm(32.0956, 34.9566, 32.084, 35.181)).toBeGreaterThan(20); // Salfit really is far
  });

  it('does not let Rosh HaAyin swallow its neighbors', () => {
    // Each of these is a distinct locality that BigDataCloud already names
    // correctly, so claiming it would replace a right answer with a wrong one.
    // Givat HaShlosha and Mazor sat inside the first draft's circular radii.
    expect(nearestLocality(32.0981, 34.9211)).toBeNull(); // Givat HaShlosha, 3.3 km W
    expect(nearestLocality(32.0777, 34.9235)).toBeNull(); // Kfar Sirkin
    expect(nearestLocality(32.0523, 34.9278)).toBeNull(); // Mazor, 2.5 km W of El'ad
    expect(nearestLocality(32.0615, 34.9493)).toBeNull(); // Nahshonim
    expect(nearestLocality(32.1309, 34.992)?.slug).toBe('oranit');
  });

  it('gives Einat back to Einat, though it sits inside the Rosh HaAyin box', () => {
    // The municipal box has to reach west to cover the city's own western
    // neighborhoods, which puts a neighboring kibbutz in its southwest corner.
    expect(nearestLocality(32.0828, 34.9394)?.slug).toBe('einat');
    // ...without Einat reaching back into the city.
    expect(nearestLocality(32.085, 34.951)?.slug).toBe('rosh-haayin');
  });

  it('leaves El\'ad search-only — BigDataCloud names it correctly', () => {
    expect(nearestLocality(32.0498, 34.9538)).toBeNull();
    expect(searchLocalities('אלעד')[0]?.slug).toBe('elad');
  });

  it('ignores search-only entries so correct remote labels survive', () => {
    // Kiryat Gat is in the index purely so Hebrew search can reach it;
    // BigDataCloud already names it correctly, so it must not claim points.
    expect(nearestLocality(31.61, 34.7642)).toBeNull();
    expect(searchLocalities('קריית גת')[0]?.slug).toBe('kiryat-gat');
  });
});

describe('localityName', () => {
  it('localizes and falls back to English', () => {
    const l = LOCALITIES.find((x) => x.slug === 'maale-adumim')!;
    expect(localityName(l, 'he')).toBe('מעלה אדומים');
    expect(localityName(l, 'ru')).toBe('Маале-Адумим');
    expect(localityName(l, 'fr')).toBe("Ma'ale Adumim");
  });
});
