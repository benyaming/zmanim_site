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
    version: '1.4',
    date: '2026-07-05',
    notes: {
      en: [
        'Special Shabbatot — Shabbat Hagadol, Shuva, Shekalim, Zachor, Parah, Hachodesh, Shira, Chazon, Nachamu — are named in the day panel and next to the weekly parasha in the calendar.',
        'The molad of the new month is shown in the day panel on Rosh Chodesh and Shabbat Mevarchim, and the calendar now marks Shabbat Mevarchim.',
        'Israeli national days added: Yom HaShoah, Yom HaZikaron, Yom HaAtzmaut and Yom Yerushalayim.',
        'Erev Pesach: the day panel now shows the chametz deadlines — latest eating and burning times (Vilna Gaon & Magen Avraham).',
      ],
      he: [
        'שבתות מיוחדות — שבת הגדול, שובה, שקלים, זכור, פרה, החודש, שירה, חזון ונחמו — מוצגות בפאנל היומי ולצד הפרשה בלוח.',
        'המולד של החודש הנכנס מוצג בפאנל היומי בראש חודש ובשבת מברכים, והלוח מסמן כעת שבת מברכים.',
        'נוספו ימי המדינה: יום השואה, יום הזיכרון, יום העצמאות ויום ירושלים.',
        'ערב פסח: הפאנל היומי מציג את זמני החמץ — סוף זמן אכילת חמץ וביעור חמץ (גר"א ומגן אברהם).',
      ],
      ru: [
        'Особые субботы — Шаббат а-Гадоль, Шува, Шкалим, Захор, Пара, а-Ходеш, Шира, Хазон и Нахаму — подписаны в панели дня и рядом с недельной главой в календаре.',
        'Молад нового месяца показывается в панели дня в Рош Ходеш и Шаббат Мевархим, а календарь теперь отмечает Шаббат Мевархим.',
        'Добавлены израильские памятные дни: День Катастрофы, День памяти, День независимости и День Иерусалима.',
        'Канун Песаха: в панели дня показываются времена хамца — конец еды и сожжения хамца (Виленский Гаон и Маген Авраам).',
      ],
    },
  },
  {
    version: '1.3',
    date: '2026-07-05',
    notes: {
      en: [
        'Clearer header icons: a gear for settings, a palette for appearance and a grid for tools, with tooltips on hover.',
      ],
      he: ['סמלים ברורים יותר בכותרת: גלגל שיניים להגדרות, פלטת צבעים למראה ורשת לכלים, עם תיאור בריחוף.'],
      ru: [
        'Более понятные значки в шапке: шестерёнка для настроек, палитра для оформления и сетка для инструментов, с подсказками при наведении.',
      ],
    },
  },
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
