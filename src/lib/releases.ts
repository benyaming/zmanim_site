/**
 * App version + per-release notes, shown in the footer's release-notes pane.
 *
 * This file — not package.json — is the source of truth for the visible
 * version. Every PR must bump the version and prepend a release entry with the
 * PR's user-facing changes in ALL THREE locales (see CLAUDE.md → Conventions).
 * Newest release first; `APP_VERSION` is derived from the top entry.
 */

type ReleaseLocale = 'en' | 'he' | 'ru';

export interface Release {
  version: string;
  /** ISO date (yyyy-mm-dd) the release was cut. */
  date: string;
  notes: Record<ReleaseLocale, string[]>;
}

export const RELEASES: readonly Release[] = [
  {
    version: '1.2',
    date: '2026-07-05',
    notes: {
      en: ['Mobile: long location names no longer overflow the header — they are trimmed with an ellipsis.'],
      he: ['נייד: שמות מיקום ארוכים כבר לא גולשים מהכותרת — הם מקוצרים עם שלוש נקודות.'],
      ru: ['Мобильная версия: длинные названия городов больше не растягивают шапку — они обрезаются многоточием.'],
    },
  },
  {
    version: '1.1',
    date: '2026-07-03',
    notes: {
      en: ['Calendar settings: choose which zmanim and opinions are shown in the day panel.'],
      he: ['הגדרות לוח: בחירת הזמנים והשיטות שיוצגו בלוח היומי.'],
      ru: ['Настройки календаря: выбор зманим и мнений, отображаемых в панели дня.'],
    },
  },
  {
    version: '1.0',
    date: '2026-07-03',
    notes: {
      en: [
        'Initial release: daily zmanim with per-opinion details and cross-validated calculations.',
        'Trilingual calendar — English, Hebrew, Russian — with holidays, parashot and candle-lighting times.',
        'Location search, GPS detection, and full support for Israeli settlements (search, labels, Israel luach).',
      ],
      he: [
        'גרסה ראשונה: זמני היום עם פירוט שיטות וחישובים מאומתים.',
        'לוח שנה תלת־לשוני — עברית, אנגלית ורוסית — עם חגים, פרשות וזמני הדלקת נרות.',
        'חיפוש מיקום, איתור GPS ותמיכה מלאה ביישובי יהודה ושומרון (חיפוש, שמות, לוח ארץ ישראל).',
      ],
      ru: [
        'Первый выпуск: зманим на каждый день с деталями по мнениям и проверенными расчётами.',
        'Трёхъязычный календарь — русский, иврит, английский — с праздниками, главами Торы и временем зажигания свечей.',
        'Поиск местоположения, GPS и полная поддержка израильских поселений (поиск, названия, израильский луах).',
      ],
    },
  },
];

export const APP_VERSION = RELEASES[0].version;

/** Notes for a release in the given UI locale, falling back to English. */
export function releaseNotes(release: Release, locale: string): string[] {
  return release.notes[locale as ReleaseLocale] ?? release.notes.en;
}
