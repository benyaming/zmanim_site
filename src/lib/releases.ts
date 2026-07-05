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
    version: '1.7',
    date: '2026-07-05',
    notes: {
      en: [
        'Optional elevation-adjusted zmanim: enable "Factor in elevation" in the calendar settings to compute sunrise, sunset and the zmanim measured from them for your location’s height above sea level (visible-horizon times). Off by default — the standard published times stay sea-level.',
        'The location’s elevation is detected automatically; while the setting is on it is shown next to the location name in the header. Degree-based zmanim, chatzot and candle lighting are unaffected, following the accepted practice.',
      ],
      he: [
        'זמנים מותאמי גובה (אופציונלי): הפעילו "התחשבות בגובה המקום" בהגדרות הלוח כדי לחשב את הנץ, השקיעה והזמנים הנמדדים מהם לפי גובה המקום מעל פני הים (אופק נראה). כבוי כברירת מחדל — הזמנים המקובלים נשארים לפי גובה פני הים.',
        'גובה המקום מזוהה אוטומטית; כשההגדרה פעילה הוא מוצג לצד שם המקום בכותרת. זמנים המבוססים על מעלות, חצות והדלקת נרות אינם מושפעים, בהתאם למנהג המקובל.',
      ],
      ru: [
        'Необязательная поправка на высоту: включите «Учитывать высоту местности» в настройках календаря, чтобы восход, закат и отсчитываемые от них зманим рассчитывались с учётом высоты над уровнем моря (видимый горизонт). По умолчанию выключено — стандартные времена остаются на уровне моря.',
        'Высота определяется автоматически; пока настройка включена, она показана рядом с названием места в шапке. Зманим по градусам, хацот и зажигание свечей не меняются, в соответствии с принятым обычаем.',
      ],
    },
  },
  {
    version: '1.6',
    date: '2026-07-05',
    notes: {
      en: [
        'The day panel now shows only the everyday zmanim by default — more zmanim and opinions can be enabled in the calendar settings.',
        'A zman with a single opinion now fits on one line.',
        'Fast ends are shown at three tzeit opinions; Tisha B’Av times appear on both the eve and the fast day.',
        'Opening a settings menu on mobile no longer pops up the keyboard.',
        'When a fast or national day is observed off its usual date because of Shabbat, the day panel says so.',
        'Switching the language keeps the selected day instead of jumping back to today.',
      ],
      he: [
        'פאנל היום מציג כעת כברירת מחדל רק את הזמנים השימושיים — זמנים ושיטות נוספים אפשר להפעיל בהגדרות לוח השנה.',
        'זמן עם שיטה אחת מוצג כעת בשורה אחת.',
        'סיום הצום מוצג בשלוש שיטות צאת הכוכבים; זמני תשעה באב מוצגים גם בערב הצום וגם ביום עצמו.',
        'פתיחת תפריט הגדרות בנייד כבר לא מקפיצה את המקלדת.',
        'כשצום או יום לאומי נדחה או הוקדם בשל שבת, פאנל היום מציין זאת.',
        'החלפת שפה שומרת על היום שנבחר במקום לחזור להיום.',
      ],
      ru: [
        'Панель дня теперь по умолчанию показывает только основные зманим — остальные зманим и мнения можно включить в настройках календаря.',
        'Зман с одним мнением теперь помещается в одну строку.',
        'Окончание поста показано по трём мнениям о выходе звёзд; времена Девятого ава видны и накануне, и в сам день поста.',
        'Открытие меню настроек на мобильном больше не вызывает клавиатуру.',
        'Если пост или национальный день перенесён из-за шаббата, панель дня сообщает об этом.',
        'Смена языка сохраняет выбранный день, а не возвращает к сегодняшнему.',
      ],
    },
  },
  {
    version: '1.5',
    date: '2026-07-05',
    notes: {
      en: [
        'New "Daily learning" section in the day panel: Daf Yomi, Yerushalmi Yomi, Mishna Yomit, Nach Yomi, daily Tehillim, Daily Rambam — and Pirkei Avot on its Shabbatot — each with a short explanation behind the info icon.',
        'Every reading links straight to its text on Sefaria.',
        'The day panel was visually unified: a tinted day header and matching ruled section headings for learning and zmanim.',
        'Calendar settings let you choose which learning cycles are displayed, just like the zmanim.',
      ],
      he: [
        'מדור חדש "לימוד יומי" בפאנל היום: דף היומי, ירושלמי יומי, משנה יומית, נ״ך יומי, תהלים יומי ורמב״ם יומי — ופרקי אבות בשבתות הקיץ — עם הסבר קצר מאחורי סמל המידע.',
        'כל לימוד מקושר ישירות לטקסט בספריא.',
        'פאנל היום עוצב מחדש באחידות: כותרת יום מודגשת וכותרות מדור אחידות עם קו לאורך — ללימוד היומי ולזמנים.',
        'בהגדרות הלוח אפשר לבחור אילו מסלולי לימוד יוצגו — בדיוק כמו הזמנים.',
      ],
      ru: [
        'Новый раздел «Ежедневное изучение» в панели дня: даф йоми, Йерушалми йоми, мишна йомит, нах йоми, теилим по дням месяца, Рамбам — и Пиркей авот по субботам — с кратким пояснением за значком информации.',
        'Каждый урок ведёт по ссылке прямо к тексту на Сефарии.',
        'Панель дня приведена к единому стилю: выделенная шапка дня и одинаковые заголовки разделов с линейкой — для изучения и зманим.',
        'В настройках календаря можно выбрать, какие циклы изучения показывать, — так же, как зманим.',
      ],
    },
  },
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
