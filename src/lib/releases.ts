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
    version: '1.11',
    date: '2026-07-05',
    notes: {
      en: [
        'New "App" section in the appearance menu: if you skipped the browser\'s suggestion to install the app, an "Install app" button lets you bring the prompt back. On browsers without one-tap install (e.g. iPhone/iPad) the section shows short instructions instead.',
      ],
      he: [
        'מדור חדש "אפליקציה" בתפריט המראה: אם דילגתם על הצעת הדפדפן להתקין את האפליקציה, כפתור "התקנת האפליקציה" מאפשר להציג את ההצעה שוב. בדפדפנים ללא התקנה בלחיצה אחת (למשל אייפון/אייפד) יוצגו במקום זאת הוראות קצרות.',
      ],
      ru: [
        'Новый раздел «Приложение» в меню оформления: если вы пропустили предложение браузера установить приложение, кнопка «Установить приложение» вызовет его снова. В браузерах без установки в одно касание (например, iPhone/iPad) вместо этого показана короткая инструкция.',
      ],
    },
  },
  {
    version: '1.10',
    date: '2026-07-05',
    notes: {
      en: [
        'Saved locations: bookmark the places you use often and switch between them from the location dialog. Each saved place keeps its original city name, its detected elevation, and an optional custom name ("Home", "Parents") shown in the header — entries can be renamed or removed at any time.',
      ],
      he: [
        'מיקומים שמורים: ניתן לשמור את המקומות שבהם אתם משתמשים לעיתים קרובות ולעבור ביניהם מחלון בחירת המיקום. כל מקום שמור כולל את שם העיר המקורי, את הגובה שזוהה עבורו ושם מותאם אישית (״בית״, ״הורים״) המוצג בכותרת — ניתן לשנות את השם או למחוק רשומות בכל עת.',
      ],
      ru: [
        'Сохранённые места: добавляйте в закладки места, которыми пользуетесь чаще всего, и переключайтесь между ними в окне выбора местоположения. У каждого сохранённого места хранятся исходное название города, определённая для него высота и необязательное своё название («Дом», «Родители»), отображаемое в шапке — записи можно переименовать или удалить в любой момент.',
      ],
    },
  },
  {
    version: '1.9',
    date: '2026-07-05',
    notes: {
      en: [
        'New "Astronomical hour" in the zmanim list — the length of one proportional hour (shaah zmanit) by the Magen Avraham and by the Vilna Gaon, shown as a duration (h:mm:ss) rather than a clock time. Hidden by default — enable it under "Displayed zmanim" in the calendar settings.',
      ],
      he: [
        'זמן חדש ברשימת הזמנים — "שעה זמנית": אורך שעה זמנית אחת לדעת המגן אברהם ולדעת הגר"א, מוצג כמשך זמן (שעות:דקות:שניות) ולא כשעת שעון. מוסתר כברירת מחדל — ניתן להפעילו תחת "זמנים מוצגים" בהגדרות הלוח.',
      ],
      ru: [
        'Новый пункт в списке зманим — «Шаа зманит (астрономический час)»: длина одного временно́го часа по Маген Аврааму и по Виленскому Гаону, показывается как длительность (ч:мм:сс), а не как время суток. По умолчанию скрыт — включается в разделе «Отображаемые зманим» в настройках календаря.',
      ],
    },
  },
  {
    version: '1.8',
    date: '2026-07-05',
    notes: {
      en: [
        'New optional "Stringent rounding (lehumra)" mode in the calendar settings: displayed times are rounded to a whole minute on the safe side — deadlines (sof zman Shema, sunset, candle lighting, fast start…) down, starting times (netz, tzeit ha-kochavim, havdala, fast end…) up. Off by default; when on, the day panel shows a small "lehumra" chip and a note under the zmanim.',
        'Candle lighting is now shown for the 2nd night of Yom Tov and for Yom Tov starting on Motzei Shabbat — at nightfall (per your havdala opinion), from an existing flame; for Shabbat after a Friday Yom Tov it stays before sunset. The day panel lists every lighting of the holiday block.',
        'With elevation enabled, the height shown in the header no longer crowds the location name: on narrow screens it drops to its own line under the name, so city names are not cut short.',
        'On mobile the footer now stays visible while scrolling, like the header.',
        'On very narrow screens (older ~360px phones) the header shows only the sun glyph, leaving room for the location and menu buttons.',
      ],
      he: [
        'מצב חדש (אופציונלי) "עיגול זמנים לחומרא" בהגדרות הלוח: הזמנים המוצגים מעוגלים לדקה שלמה לצד המחמיר — זמני סוף (סוף זמן קריאת שמע, שקיעה, הדלקת נרות, תחילת צום…) כלפי מטה, וזמני התחלה (נץ, צאת הכוכבים, הבדלה, סיום צום…) כלפי מעלה. כבוי כברירת מחדל; כשהוא פעיל, פאנל היום מציג תג "לחומרא" קטן והערה מתחת לזמנים.',
        'הדלקת נרות מוצגת כעת גם לליל יום טוב שני וליום טוב שחל במוצאי שבת — בצאת הכוכבים (לפי שיטת ההבדלה שבחרתם), מאש קיימת; לשבת שאחרי יום טוב שחל ביום שישי ההדלקה נשארת לפני השקיעה. פאנל היום מציג את כל ההדלקות של רצף החג.',
        'כשההתחשבות בגובה פעילה, הגובה בכותרת כבר אינו דוחק את שם המקום: במסכים צרים הוא יורד לשורה נפרדת מתחת לשם, כך ששמות ערים אינם נקטעים.',
        'בנייד הכותרת התחתונה נשארת כעת גלויה בזמן גלילה, כמו הכותרת העליונה.',
        'במסכים צרים מאוד (מכשירים ישנים ברוחב ~360px) הכותרת מציגה רק את סמל השמש, ומפנה מקום למיקום ולתפריטים.',
      ],
      ru: [
        'Новый необязательный режим «Строгое округление (лехумра)» в настройках календаря: показанные времена округляются до целой минуты в строгую сторону — конечные времена (соф зман крият Шма, закат, зажигание свечей, начало поста…) вниз, начальные (анец, цет а-кохавим, авдала, конец поста…) вверх. По умолчанию выключен; когда включён, в панели дня видны небольшая метка «лехумра» и пояснение под зманим.',
        'Зажигание свечей теперь показано и для второй ночи Йом Това, и для Йом Това, начинающегося на исходе Шаббата — после выхода звёзд (по выбранному мнению для авдалы), от существующего огня; для Шаббата после пятничного Йом Това зажигание остаётся до заката. Панель дня показывает все зажигания праздничного блока.',
        'При включённом учёте высоты она больше не теснит название места в шапке: на узких экранах высота переносится на отдельную строку под названием, и названия городов не обрезаются.',
        'На мобильных нижняя панель теперь остаётся видимой при прокрутке, как и шапка.',
        'На очень узких экранах (старые телефоны ~360px) в шапке остаётся только значок солнца — освобождая место для локации и меню.',
      ],
    },
  },
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
