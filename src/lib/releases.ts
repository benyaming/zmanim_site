/**
 * App version + per-release notes, shown in the footer's release-notes pane
 * and in the "What's new" popup on first load after an update.
 *
 * This file — not package.json — is the source of truth for the visible
 * version. Bump the version and prepend a release entry (in ALL THREE locales)
 * for user-facing changes worth announcing; minor fixes, small UI tweaks and
 * internal-only refactors don't need a bump (see CLAUDE.md → Conventions).
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
    version: '1.28',
    date: '2026-09-02',
    notes: {
      en: [
        'The day panel marks the days Yizkor is recited.',
        'The calendar export can leave out candle lighting, havdala and fast times.',
      ],
      he: [
        'לוח היום מציין את הימים שאומרים בהם יזכור.',
        'בייצוא לוח השנה אפשר להשמיט הדלקת נרות, הבדלה וזמני צום.',
      ],
      ru: [
        'Панель дня отмечает дни, когда читают Изкор.',
        'В экспорте календаря можно убрать зажигание свечей, авдалу и времена постов.',
      ],
    },
  },
  {
    version: '1.27',
    date: '2026-08-31',
    notes: {
      en: ['Daily learning starts with Daf Yomi alone — the other six cycles are now opt-in.'],
      he: ['הלימוד היומי מתחיל בדף היומי בלבד — ששת המסלולים האחרים לבחירה.'],
      ru: ['Ежедневное изучение начинается только с Даф йоми — остальные шесть циклов по выбору.'],
    },
  },
  {
    version: '1.26',
    date: '2026-08-11',
    notes: {
      en: [
        'A new panel explains the calculation methods behind the zmanim.',
        'Method labels now state each opinion in its own unit — degrees as degrees, minutes as minutes.',
      ],
      he: [
        'לוח חדש מסביר את שיטות החישוב של הזמנים.',
        'תוויות השיטה מציינות כל דעה ביחידות שלה — מעלות כמעלות ודקות כדקות.',
      ],
      ru: [
        'Новая панель объясняет методы расчёта зманим.',
        'Обозначения методов называют мнение в его единицах: градусы — градусами, минуты — минутами.',
      ],
    },
  },
  {
    version: '1.25',
    date: '2026-08-09',
    notes: {
      en: [
        'The zmanim PDF is rebuilt: a month per sheet — civil or Hebrew — with fasts and molad in the footer.',
        'Daily learning prints on its own sheet, and a live preview shows every page before you download.',
        'The zmanim export remembers your last selection.',
      ],
      he: [
        'ה־PDF של הזמנים נבנה מחדש: חודש בכל עמוד — לועזי או עברי — והצומות והמולד בתחתית העמוד.',
        'הלימוד היומי מודפס בעמוד משלו, ותצוגה מקדימה מציגה כל עמוד לפני ההורדה.',
        'ייצוא הזמנים זוכר את הבחירה האחרונה שלך.',
      ],
      ru: [
        'PDF зманим переработан: месяц на листе — григорианский или еврейский, посты и молад — внизу листа.',
        'Ежедневная учёба печатается отдельным листом, а предпросмотр показывает каждый лист до скачивания.',
        'Экспорт зманим запоминает последний выбор.',
      ],
    },
  },
  {
    version: '1.24',
    date: '2026-07-26',
    notes: {
      en: [
        'Sign in with Google — your settings sync across devices without Telegram.',
        'One sync account per device — and sync never overwrites or drops your data without asking.',
        'In Telegram, choosing a location in the app no longer changes the bot’s own location.',
      ],
      he: [
        'התחברות עם Google — ההגדרות מסתנכרנות בין המכשירים גם בלי טלגרם.',
        'חשבון סנכרון אחד למכשיר — והסנכרון לא דורס ולא מוחק נתונים בלי לשאול.',
        'בטלגרם, בחירת מיקום באפליקציה כבר לא משנה את המיקום של הבוט.',
      ],
      ru: [
        'Вход через Google — настройки синхронизируются между устройствами и без Telegram.',
        'Один аккаунт синхронизации на устройство — и синхронизация ничего не перезапишет и не удалит без вопроса.',
        'В Telegram выбор места в приложении больше не меняет место, выбранное в боте.',
      ],
    },
  },
  {
    version: '1.23',
    date: '2026-07-21',
    notes: {
      en: [
        'Personal dates reworked around people — add someone once, with their birthday, bris, bar/bat mitzvah, wedding and passing.',
        'A passing now shows shiva, shloshim and the yahrzeit automatically; every date marks both its Hebrew and civil anniversary.',
      ],
      he: [
        'התאריכים האישיים מסודרים סביב אנשים — מוסיפים אדם פעם אחת, עם יום הולדת, ברית, בר/בת מצווה, נישואין ופטירה.',
        'פטירה מציגה אוטומטית שבעה, שלושים ויום השנה; כל תאריך מסומן ביום השנה העברי והלועזי כאחד.',
      ],
      ru: [
        'Личные даты переработаны вокруг людей — добавьте человека один раз, с днём рождения, бритом, бар/бат-мицвой, свадьбой и датой кончины.',
        'Кончина автоматически показывает шиву, шлошим и йорцайт; каждая дата отмечается и по еврейскому, и по гражданскому календарю.',
      ],
    },
  },
  {
    version: '1.22',
    date: '2026-07-20',
    notes: {
      en: [
        'Your settings now sync across devices through your Telegram account.',
        'Or move them to another device with a link or a file — no account needed.',
      ],
      he: [
        'ההגדרות מסתנכרנות כעת בין המכשירים דרך חשבון הטלגרם שלך.',
        'לחלופין אפשר להעביר אותן למכשיר אחר בקישור או בקובץ — בלי חשבון.',
      ],
      ru: [
        'Настройки теперь синхронизируются между устройствами через ваш аккаунт Telegram.',
        'Или перенесите их на другое устройство ссылкой либо файлом — без аккаунта.',
      ],
    },
  },
  {
    version: '1.21',
    date: '2026-07-19',
    notes: {
      en: ['Very old browsers that can’t render the site now get a clear update notice instead of a broken page.'],
      he: ['דפדפנים ישנים שאינם יכולים להציג את האתר מקבלים כעת הודעת עדכון ברורה במקום עמוד שבור.'],
      ru: ['Устаревшие браузеры, не способные отобразить сайт, теперь видят понятное предложение обновиться вместо сломанной страницы.'],
    },
  },
  {
    version: '1.20',
    date: '2026-07-16',
    notes: {
      en: [
        'The calendar now runs as a Telegram Mini App inside zmanim_bot, opening on your bot location.',
        'Location, candle-lighting offset, and havdalah opinion stay in sync with the bot both ways.',
      ],
      he: [
        'הלוח פועל כעת כמיני-אפליקציה בטלגרם בתוך zmanim_bot, ונפתח על המיקום שנבחר בבוט.',
        'מיקום, זמן הדלקת נרות ושיטת ההבדלה מסונכרנים עם הבוט בשני הכיוונים.',
      ],
      ru: [
        'Календарь теперь работает как мини-приложение Telegram внутри zmanim_bot и открывается на вашей локации из бота.',
        'Локация, время зажигания свечей и мнение для авдалы синхронизируются с ботом в обе стороны.',
      ],
    },
  },
  {
    version: '1.19',
    date: '2026-07-16',
    notes: {
      en: [
        'Short-night fix: a zman the sun never reaches is shown as having no time, with an explanation — never an estimate under another opinion’s name.',
        'Fasts at such locations begin AND end at a labelled fixed-minute time, so an end always shows — even on Tisha B’Av.',
        'Opinions are now grouped by how they are calculated — Alot/Tzeit by sun angle or minutes, Shma/Tfila by the day used — each explained.',
      ],
      he: [
        'תיקון ללילה קצר: זמן שהשמש אינה מגיעה אליו מוצג כחסר, עם הסבר — ולא כאומדן בשם שיטה אחרת.',
        'במקומות אלו התענית מתחילה ומסתיימת בזמן קבוע מסומן — כך שסוף התענית תמיד מוצג, גם בתשעה באב.',
        'השיטות מקובצות לפי אופן החישוב — עלות/צאת לפי זווית השמש או דקות, וזמן שמע/תפילה לפי אורך היום — עם הסבר לכל אחד.',
      ],
      ru: [
        'Исправление для короткой ночи: зман, до которого солнце не опускается, показывается как отсутствующий с пояснением, а не оценкой от имени другого мнения.',
        'В таких местах пост начинается и завершается по фиксированным минутам с указанием мнения — конец всегда показан.',
        'Мнения сгруппированы по способу расчёта — заря/выход звёзд по углу солнца или минутам, Шма/Тфила по длине дня — с пояснением каждого.',
      ],
    },
  },
  {
    version: '1.18',
    date: '2026-07-12',
    notes: {
      en: [
        'Short-night locations now show a flagged seasonal-hour estimate for zmanim the degree method can’t reach.',
        'Settings: a Restore defaults option for the displayed zmanim and fast-end times.',
        'Exports: pick any columns & transpose the zmanim table, and add zmanim or learnings to each calendar-grid day.',
      ],
      he: [
        'מיקומים עם לילה קצר: זמנים שאין להם חישוב לפי מעלות מוצגים כאומדן לפי שעה זמנית, עם סימון.',
        'הגדרות: אפשרות שחזור ברירת מחדל לזמנים המוצגים ולזמני סיום התענית.',
        'ייצוא: בחירת עמודות והיפוך טבלת הזמנים, והוספת זמנים או לימודים לכל יום בלוח.',
      ],
      ru: [
        'Места с короткой ночью: зманим, недоступные для расчёта по градусам, показываются как оценка по временно́му часу с пометкой.',
        'Настройки: сброс к стандартным для отображаемых зманим и времён окончания поста.',
        'Экспорт: выбор столбцов и транспонирование таблицы зманим, плюс зманим или уроки в каждом дне календаря.',
      ],
    },
  },
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
