/**
 * A concise explanation of the calculation methods shown in zman labels.
 *
 * Long-form localized prose lives here rather than in `messages/*.json`. The
 * worked examples are generated from the real calculator in help-content.tsx,
 * so their times cannot drift from the application.
 */

export type HelpLocale = 'en' | 'he' | 'ru';

/** A generated block rendered after a section's prose. */
export type HelpGenerated =
  /** Jerusalem near the equinox: the degree/minute pairs that name the angles. */
  | 'equinoxAnchor'
  /** A high-latitude midsummer morning: where the degree opinions run out. */
  | 'shortNight';

/** A labelled item in a section's definition list. */
export interface HelpTerm {
  term: string;
  body: string;
}

export interface HelpSection {
  /** Stable anchor id — deep-linkable, identical across locales. */
  id: string;
  heading: string;
  /** Paragraphs, in order. */
  body: string[];
  /** Optional definition list, rendered under the paragraphs. */
  terms?: HelpTerm[];
  /** Optional generated block, rendered under everything else. */
  generated?: HelpGenerated;
}

export interface HelpDoc {
  title: string;
  /** One-paragraph summary shown under the title. */
  lede: string;
  sections: HelpSection[];
}

export const HELP: Record<HelpLocale, HelpDoc> = {
  en: {
    title: 'Calculation methods',
    lede: 'Dawn and nightfall use fixed minutes, seasonal minutes or the sun’s angle. For zmanim within the day, the method also determines the day’s boundaries and therefore the length of a seasonal hour.',
    sections: [
      {
        id: 'twilight-methods',
        heading: 'Methods for dawn and nightfall',
        body: [],
        terms: [
          {
            term: 'Fixed minutes',
            body: 'An exact number of ordinary minutes is counted before sunrise or after sunset. The interval is the same on every date and at every location.',
          },
          {
            term: 'Seasonal minutes',
            body: 'The unit is derived from the length of the sunrise-to-sunset day. Seventy-two seasonal minutes equal one tenth of that day, so the clock interval is longer in summer and shorter in winter.',
          },
          {
            term: 'Solar depression',
            body: 'The zman occurs when the sun is the stated number of degrees below the horizon. The clock interval from sunrise or sunset changes with the date and latitude.',
          },
        ],
      },
      {
        id: 'minutes-and-degrees',
        heading: 'The link between minutes and degrees',
        body: [
          'The angles 16.1° and 19.8° were chosen to match 72 and 90 minutes near the equinox in Eretz Yisrael. That historical match explains the names; it is not a rule for converting degrees into minutes.',
          'The table shows the reference case. On other dates and at other latitudes, the fixed-minute and degree results separate.',
        ],
        generated: 'equinoxAnchor',
      },
      {
        id: 'day-boundaries',
        heading: 'The boundaries of the day',
        body: [
          'Times within the day are calculated after its beginning and end have been chosen. The Vilna Gaon uses sunrise to sunset; the Magen Avraham uses dawn to nightfall; the Baal HaTanya uses his own definitions of sunrise and sunset.',
          'The selected day is divided into twelve seasonal hours. This is why the third hour for Shma or the tenth and three-quarter hour for plag can produce different clock times even when the ordinal hour is the same.',
        ],
      },
      {
        id: 'labels',
        heading: 'Reading a label',
        body: ['A label states the inputs to the calculation. The unit and the day boundary are part of the method.'],
        terms: [
          { term: '72 minutes', body: 'Exactly 72 ordinary minutes before sunrise or after sunset.' },
          { term: '72 seasonal minutes', body: 'One tenth of that date’s sunrise-to-sunset day.' },
          { term: '16.1°', body: 'The moment when the sun is 16.1 degrees below the horizon.' },
          {
            term: 'Magen Avraham · dawn 16.1°',
            body: 'The day begins at 16.1° dawn and ends at the corresponding nightfall, then that interval is divided into twelve hours.',
          },
        ],
      },
      {
        id: 'degree-limits',
        heading: 'Limits of degree calculations',
        body: [
          'At high latitudes in summer, the sun may not reach a specified angle below the horizon. In that case the degree method has no result and the row shows a dash.',
          'Fixed and seasonal minute methods may still produce a time. They remain separate results and are not substituted for the missing degree calculation.',
        ],
        generated: 'shortNight',
      },
    ],
  },

  ru: {
    title: 'Методы расчёта зманим',
    lede: 'Заря (алот а-шахар) наступает до восхода солнца, а ночь (цет а-кохавим) — после заката. Для определения этих моментов используются фиксированные минуты, временны́е минуты или угол солнца. Для других зманим метод также задаёт границы дня и тем самым продолжительность временно́го часа.',
    sections: [
      {
        id: 'twilight-methods',
        heading: 'Методы определения зари и наступления ночи',
        body: [],
        terms: [
          {
            term: 'Фиксированные минуты',
            body: 'От восхода или заката отсчитывается указанное количество обычных минут. Этот промежуток не зависит от даты и места.',
          },
          {
            term: 'Временны́е минуты',
            body: 'Длительность минуты зависит от продолжительности светового дня. 72 временны́е минуты равны одной десятой промежутка от восхода до заката, поэтому летом они длиннее, а зимой короче 72 обычных минут.',
          },
          {
            term: 'Угол солнца',
            body: 'Зман наступает, когда солнце находится на указанное число градусов ниже горизонта. Промежуток до восхода или после заката зависит от даты и широты.',
          },
        ],
      },
      {
        id: 'minutes-and-degrees',
        heading: 'Связь между минутами и градусами',
        body: [
          'В Эрец-Исраэль в дни весеннего и осеннего равноденствия углы 16,1° и 19,8° соответствуют 72 и 90 минутам. Отсюда связь между названиями методов, но это не универсальная формула перевода градусов в минуты.',
          'В таблице показано это совпадение для Иерусалима в день весеннего равноденствия. В другие даты и на других широтах результаты расчёта по углу и по фиксированным минутам расходятся.',
        ],
        generated: 'equinoxAnchor',
      },
      {
        id: 'day-boundaries',
        heading: 'Границы дня',
        body: [
          'Для расчёта других зманим сначала определяют начало и конец алахического дня. Виленский Гаон считает от восхода солнца (анец а-хама) до заката (шкия), Маген Авраам — от зари (алот а-шахар) до наступления ночи (цет а-кохавим). Бааль а-Тания также считает от восхода до заката, но определяет эти моменты по-своему.',
          'Выбранный промежуток делится на двенадцать временны́х часов. Поэтому конец третьего часа для Шма или 10¾ часа для плаг а-минха дают разное время на часах при разных границах дня.',
        ],
      },
      {
        id: 'labels',
        heading: 'Обозначения методов',
        body: ['Обозначение содержит исходные параметры расчёта. Единица измерения и границы дня являются частью метода.'],
        terms: [
          { term: '72 минуты', body: 'Ровно 72 обычные минуты до восхода или после заката.' },
          { term: '72 временны́е минуты', body: 'Одна десятая светового дня от восхода до заката.' },
          { term: '16,1°', body: 'Момент, когда солнце находится на 16,1° ниже горизонта.' },
          {
            term: 'Маген Авраам · алот 16,1°',
            body: 'День начинается при алот 16,1°, заканчивается при соответствующем цет и затем делится на двенадцать часов.',
          },
        ],
      },
      {
        id: 'degree-limits',
        heading: 'Ограничения расчёта по углу',
        body: [
          'Летом в высоких широтах солнце может не опуститься на заданный угол ниже горизонта. Тогда угловой метод не даёт результата, и вместо времени отображается прочерк.',
          'Расчёты по фиксированным и временны́м минутам при этом могут быть доступны. Они показываются отдельно и не заменяют отсутствующий результат углового метода.',
        ],
        generated: 'shortNight',
      },
    ],
  },

  he: {
    title: 'שיטות חישוב הזמנים',
    lede: 'עלות וצאת נקבעים לפי דקות קבועות, דקות זמניות או זווית השמש. בזמנים שבתוך היום השיטה קובעת גם את גבולות היום, וממילא את אורכה של שעה זמנית.',
    sections: [
      {
        id: 'twilight-methods',
        heading: 'שיטות לקביעת עלות וצאת',
        body: [],
        terms: [
          {
            term: 'דקות קבועות',
            body: 'מונים מספר קבוע של דקות רגילות לפני הנץ או אחרי השקיעה. משך הזמן אינו משתנה לפי התאריך או המקום.',
          },
          {
            term: 'דקות זמניות',
            body: 'אורך הדקה נגזר מאורך היום שבין הנץ לשקיעה. 72 דקות זמניות הן עשירית מן היום, ולכן הן ארוכות יותר בקיץ וקצרות יותר בחורף.',
          },
          {
            term: 'מעלות השמש',
            body: 'הזמן חל כשהשמש נמצאת במספר המעלות הנקוב מתחת לאופק. המרווח מן הנץ או מן השקיעה משתנה לפי התאריך וקו הרוחב.',
          },
        ],
      },
      {
        id: 'minutes-and-degrees',
        heading: 'הקשר בין דקות למעלות',
        body: [
          'הזוויות 16.1° ו־19.8° נקבעו כנגד 72 ו־90 דקות סמוך לשוויון בארץ ישראל. ההתאמה מסבירה את הקשר בין שמות השיטות, אך איננה נוסחה להמרת מעלות בדקות.',
          'הטבלה מציגה את מקרה הייחוס. בתאריך אחר או בקו רוחב אחר תוצאות החישוב לפי מעלות ולפי דקות קבועות נפרדות.',
        ],
        generated: 'equinoxAnchor',
      },
      {
        id: 'day-boundaries',
        heading: 'גבולות היום',
        body: [
          'זמנים שבתוך היום מחושבים לאחר שנקבעו תחילתו וסופו. הגר״א מונה מהנץ עד השקיעה, המגן אברהם מעלות עד צאת, ובעל התניא משתמש בהגדרותיו שלו להנץ ולשקיעה.',
          'את היום שנבחר מחלקים לשתים־עשרה שעות זמניות. לכן סוף השעה השלישית לקריאת שמע או עשר ושלושה רבעים לפלג המנחה נותנים שעה אחרת בשעון כאשר גבולות היום שונים.',
        ],
      },
      {
        id: 'labels',
        heading: 'קריאת התווית',
        body: ['התווית כוללת את נתוני היסוד של החישוב. יחידת המידה וגבולות היום הם חלק מן השיטה.'],
        terms: [
          { term: '72 דקות', body: '72 דקות רגילות בדיוק לפני הנץ או אחרי השקיעה.' },
          { term: '72 דקות זמניות', body: 'עשירית מן היום שבין הנץ לשקיעה.' },
          { term: '16.1°', body: 'הרגע שבו השמש נמצאת 16.1 מעלות מתחת לאופק.' },
          {
            term: 'מגן אברהם · עלות 16.1°',
            body: 'היום מתחיל בעלות של 16.1°, מסתיים בצאת המקביל, ולאחר מכן מתחלק לשתים־עשרה שעות.',
          },
        ],
      },
      {
        id: 'degree-limits',
        heading: 'מגבלות החישוב לפי מעלות',
        body: [
          'בקווי רוחב גבוהים בקיץ השמש עשויה שלא להגיע לזווית הנדרשת מתחת לאופק. במקרה כזה החישוב לפי מעלות אינו מניב תוצאה ובמקום השעה מופיע קו.',
          'חישובים לפי דקות קבועות או זמניות עשויים עדיין להיות זמינים. הם מוצגים בנפרד ואינם מחליפים את תוצאת המעלות החסרה.',
        ],
        generated: 'shortNight',
      },
    ],
  },
};
