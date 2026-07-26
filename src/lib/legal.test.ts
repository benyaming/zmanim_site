import { describe, expect, it } from 'vitest';

import { LEGAL_UPDATED, PRIVACY, TERMS, type LegalDoc, type LegalLocale } from './legal';

const LOCALES: LegalLocale[] = ['en', 'he', 'ru'];
const DOCS: [string, Record<LegalLocale, LegalDoc>][] = [
  ['privacy', PRIVACY],
  ['terms', TERMS],
];

describe('legal documents', () => {
  it.each(DOCS)('%s exists in every locale with the same sections', (_name, doc) => {
    const shape = (locale: LegalLocale) => doc[locale].sections.map((s) => s.body.length);
    for (const locale of LOCALES) {
      expect(doc[locale]).toBeDefined();
      // A locale silently missing a paragraph is the failure mode here: the
      // translations must say the same things, not merely all be present.
      expect(shape(locale)).toEqual(shape('en'));
    }
  });

  it.each(DOCS)('%s has no empty heading, paragraph or title', (_name, doc) => {
    for (const locale of LOCALES) {
      const { title, lede, sections } = doc[locale];
      expect(title.trim()).not.toBe('');
      expect(lede.trim()).not.toBe('');
      expect(sections.length).toBeGreaterThan(0);
      for (const section of sections) {
        expect(section.heading.trim()).not.toBe('');
        for (const paragraph of section.body) expect(paragraph.trim()).not.toBe('');
      }
    }
  });

  /** Google requires the policy to disclose how Google user data is handled. */
  it('privacy policy covers Google sign-in and where the data is stored', () => {
    for (const locale of LOCALES) {
      const text = JSON.stringify(PRIVACY[locale]);
      expect(text).toContain('Google');
      expect(text).toContain('Zmanim'); // discloses the bot service that stores it
    }
  });

  it('has a valid last-updated date', () => {
    expect(LEGAL_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(LEGAL_UPDATED))).toBe(false);
  });
});
