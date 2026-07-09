/**
 * App version + per-release notes, shown in the footer's release-notes pane
 * and in the "What's new" popup on first load after an update.
 *
 * This file — not package.json — is the source of truth for the visible
 * version. Every PR must bump the version and prepend a release entry with the
 * PR's user-facing changes in ALL THREE locales (see CLAUDE.md → Conventions).
 * Notes are one to three one-line bullets naming the headline features only —
 * fold minor tweaks into a single line or drop them; never explain usage.
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
    version: '1.17',
    date: '2026-07-09',
    notes: {
      en: [
        'Many more zman opinions — Baal HaTanya, Rabbeinu Tam, extra Tzeit / Alot / Misheyakir shitot — opt-in in settings.',
        'Configurable end-of-fast times, including the earlier gmar-taanis (three-medium-stars) opinions for minor fasts.',
        'Accurate, source-checked descriptions for every zman and opinion; the day panel now lists them in time order.',
      ],
      he: [
        'שיטות רבות נוספות לזמנים — בעל התניא, רבנו תם ועוד שיטות צאת הכוכבים, עלות וציצית — לבחירה בהגדרות.',
        'זמני סיום תענית הניתנים להגדרה, כולל שיטות גמר תענית המוקדמות (שלושה כוכבים בינוניים) לתעניות קלות.',
        'תיאורים מדויקים ומאומתים לכל זמן ושיטה; פאנל היום מציג אותם לפי סדר הזמן.',
      ],
      ru: [
        'Больше мнений для зманим — Бааль а-Тания, Рабейну Там, дополнительные шитот выхода звёзд, зари и мишеякир — по выбору в настройках.',
        'Настраиваемое время окончания поста, включая более ранние мнения гмар-таанит (три средние звезды) для малых постов.',
        'Точные, сверенные с источниками описания каждого змана и мнения; панель дня показывает их по времени.',
      ],
    },
  },
  {
    version: '1.16',
    date: '2026-07-09',
    notes: {
      en: [
        'Zmanim export adds a CSV format and optional daily-learning columns.',
        'Fast days now stand out in red on the calendar.',
        'Fixed the calendar controls wrapping to a second line when the month label is long.',
      ],
      he: [
        'ייצוא הזמנים כולל כעת פורמט CSV ועמודות לימוד יומי לבחירה.',
        'ימי תענית מסומנים כעת באדום בלוח.',
        'תוקן: כפתורי הלוח נשברו לשורה שנייה כשתווית החודש ארוכה.',
      ],
      ru: [
        'Экспорт зманим получил формат CSV и столбцы ежедневного изучения.',
        'Постовые дни теперь выделены красным в календаре.',
        'Исправлено: кнопки календаря переносились на вторую строку при длинном названии месяца.',
      ],
    },
  },
  {
    version: '1.15',
    date: '2026-07-06',
    notes: {
      en: [
        'Personal dates: birthdays, bar/bat mitzvahs and yahrzeits on the calendar, entered by Hebrew or Gregorian date.',
        'Custom Hebrew and civil date pickers throughout, replacing the browser default.',
        'Option to include personal dates on the exported calendar.',
      ],
      he: [
        'תאריכים אישיים: ימי הולדת, בר/בת מצווה ויארצייט בלוח, בהזנה עברית או לועזית.',
        'בוחרי תאריך עבריים ולועזיים מותאמים בכל האפליקציה, במקום ברירת המחדל של הדפדפן.',
        'אפשרות לכלול תאריכים אישיים בייצוא לוח השנה.',
      ],
      ru: [
        'Личные даты: дни рождения, бар/бат-мицвы и йорцайты в календаре, ввод по еврейской или григорианской дате.',
        'Свои выборы еврейской и григорианской даты по всему приложению вместо стандартного браузерного.',
        'Возможность добавить личные даты в экспорт календаря.',
      ],
    },
  },
  {
    version: '1.14',
    date: '2026-07-06',
    notes: {
      en: ['New Tools menu: calendar export (print-ready PDF) and zmanim export (Excel/PDF).'],
      he: ['תפריט כלים חדש: ייצוא לוח שנה (PDF מוכן להדפסה) וייצוא זמנים (Excel/PDF).'],
      ru: ['Новое меню инструментов: экспорт календаря (PDF для печати) и экспорт зманим (Excel/PDF).'],
    },
  },
  {
    version: '1.13',
    date: '2026-07-06',
    notes: {
      en: ['Swipe the calendar left or right on touchscreens to change month.'],
      he: ['החלקת הלוח שמאלה או ימינה במסכי מגע מחליפה חודש.'],
      ru: ['Свайп календаря влево или вправо на сенсорных экранах листает месяцы.'],
    },
  },
  {
    version: '1.12',
    date: '2026-07-06',
    notes: {
      en: ['Fixed day cells clipping times and holiday labels on iPhone/iPad.'],
      he: ['תוקן חיתוך זמנים ותוויות חגים בתאי הלוח באייפון/אייפד.'],
      ru: ['Исправлено обрезание времён и названий праздников в ячейках календаря на iPhone/iPad.'],
    },
  },
  {
    version: '1.11',
    date: '2026-07-05',
    notes: {
      en: ['"Install app" button in the appearance menu.'],
      he: ['כפתור "התקנת האפליקציה" בתפריט המראה.'],
      ru: ['Кнопка «Установить приложение» в меню оформления.'],
    },
  },
  {
    version: '1.10',
    date: '2026-07-05',
    notes: {
      en: ['Saved locations: bookmark places and switch between them, with custom names.'],
      he: ['מיקומים שמורים: שמירת מקומות ומעבר ביניהם, עם שמות מותאמים אישית.'],
      ru: ['Сохранённые места: закладки мест и переключение между ними, со своими названиями.'],
    },
  },
  {
    version: '1.9',
    date: '2026-07-05',
    notes: {
      en: ['New "Astronomical hour" zman — shaah zmanit by MA & GRA.'],
      he: ['זמן חדש "שעה זמנית" — לדעת המג"א והגר"א.'],
      ru: ['Новый зман «Шаа зманит (астрономический час)» — по Маген Аврааму и Виленскому Гаону.'],
    },
  },
  {
    version: '1.8',
    date: '2026-07-05',
    notes: {
      en: [
        'Optional stringent rounding (lehumra) of displayed times.',
        'Candle lighting for the 2nd night of Yom Tov and for Yom Tov on Motzei Shabbat.',
        'Mobile and narrow-screen layout polish.',
      ],
      he: [
        'עיגול זמנים לחומרא (אופציונלי).',
        'הדלקת נרות לליל יום טוב שני וליום טוב שחל במוצאי שבת.',
        'שיפורי פריסה בנייד ובמסכים צרים.',
      ],
      ru: [
        'Необязательное строгое округление времён (ле-хумра).',
        'Зажигание свечей для второй ночи Йом Това и Йом Това на исходе Шаббата.',
        'Улучшения вёрстки на мобильных и узких экранах.',
      ],
    },
  },
  {
    version: '1.7',
    date: '2026-07-05',
    notes: {
      en: ['Optional elevation-adjusted zmanim.'],
      he: ['זמנים מותאמי גובה (אופציונלי).'],
      ru: ['Необязательная поправка зманим на высоту местности.'],
    },
  },
  {
    version: '1.6',
    date: '2026-07-05',
    notes: {
      en: [
        'The day panel shows only the everyday zmanim by default.',
        'Fast ends at three tzeit opinions; Tisha B’Av times shown on the eve too.',
        'Small fixes on mobile and around language switching.',
      ],
      he: [
        'פאנל היום מציג כברירת מחדל רק את הזמנים השימושיים.',
        'סיום צום בשלוש שיטות צאת הכוכבים; זמני תשעה באב מוצגים גם בערב הצום.',
        'תיקונים קטנים בנייד ובהחלפת שפה.',
      ],
      ru: [
        'Панель дня по умолчанию показывает только основные зманим.',
        'Конец поста по трём мнениям о выходе звёзд; времена Девятого ава видны и накануне.',
        'Мелкие исправления на мобильных и при смене языка.',
      ],
    },
  },
  {
    version: '1.5',
    date: '2026-07-05',
    notes: {
      en: [
        'New "Daily learning" section — Daf Yomi, Mishna Yomit, Rambam and more, with links to Sefaria.',
        'Refreshed day-panel design.',
      ],
      he: [
        'מדור חדש "לימוד יומי" — דף יומי, משנה יומית, רמב״ם ועוד, עם קישורים לספריא.',
        'עיצוב מרוענן לפאנל היום.',
      ],
      ru: [
        'Новый раздел «Ежедневное изучение» — даф йоми, мишна йомит, Рамбам и другое, со ссылками на Сефарию.',
        'Обновлённый дизайн панели дня.',
      ],
    },
  },
  {
    version: '1.4',
    date: '2026-07-05',
    notes: {
      en: [
        'Special Shabbatot, molad and Shabbat Mevarchim in the calendar.',
        'Israeli national days and Erev Pesach chametz times.',
      ],
      he: [
        'שבתות מיוחדות, מולד ושבת מברכים בלוח.',
        'ימי המדינה וזמני חמץ בערב פסח.',
      ],
      ru: [
        'Особые субботы, молад и Шаббат Мевархим в календаре.',
        'Израильские памятные дни и времена хамца в канун Песаха.',
      ],
    },
  },
  {
    version: '1.3',
    date: '2026-07-05',
    notes: {
      en: ['Clearer header icons with tooltips.'],
      he: ['סמלים ברורים יותר בכותרת, עם תיאור בריחוף.'],
      ru: ['Более понятные значки в шапке, с подсказками.'],
    },
  },
  {
    version: '1.2',
    date: '2026-07-05',
    notes: {
      en: ['Mobile: long location names are trimmed with an ellipsis.'],
      he: ['נייד: שמות מיקום ארוכים מקוצרים בשלוש נקודות.'],
      ru: ['Мобильные: длинные названия городов обрезаются многоточием.'],
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
        'Location search, GPS detection, full support for Israeli settlements.',
      ],
      he: [
        'גרסה ראשונה: זמני היום עם פירוט שיטות וחישובים מאומתים.',
        'לוח שנה תלת־לשוני — עברית, אנגלית ורוסית — עם חגים, פרשות וזמני הדלקת נרות.',
        'חיפוש מיקום, איתור GPS ותמיכה מלאה ביישובי יהודה ושומרון.',
      ],
      ru: [
        'Первый выпуск: зманим на каждый день с деталями по мнениям и проверенными расчётами.',
        'Трёхъязычный календарь — русский, иврит, английский — с праздниками, главами Торы и зажиганием свечей.',
        'Поиск местоположения, GPS и полная поддержка израильских поселений.',
      ],
    },
  },
];

export const APP_VERSION = RELEASES[0].version;

/** Notes for a release in the given UI locale, falling back to English. */
export function releaseNotes(release: Release, locale: string): string[] {
  return release.notes[locale as ReleaseLocale] ?? release.notes.en;
}

/**
 * Numeric compare of dotted version strings, so "1.10" > "1.9". Non-numeric
 * segments (e.g. a corrupted persisted version) count as 0, so the result is
 * always finite — a garbage last-seen version reads as older than everything.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (version: string) =>
    version.split('.').map((segment) => {
      const n = Number(segment);
      return Number.isFinite(n) ? n : 0;
    });
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Releases newer than the version the user last saw — the content of the
 * "What's new" popup. With no last-seen version (first visit, or a visit from
 * before the popup existed) every release is unseen.
 */
export function releasesSince(lastSeen: string | null): readonly Release[] {
  if (!lastSeen) return RELEASES;
  return RELEASES.filter((release) => compareVersions(release.version, lastSeen) > 0);
}
