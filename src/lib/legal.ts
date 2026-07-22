/**
 * Privacy policy and terms of use, in all three site languages.
 *
 * Long-form localized prose lives here rather than in `messages/*.json` for the
 * same reason the release notes do (see releases.ts): it is documentation, not
 * UI strings, and keeping the three locales of a section side by side is what
 * makes them reviewable. A completeness test pins that every locale has the
 * same sections.
 *
 * These pages are also a Google requirement: an external OAuth app in
 * production must publish a home page, a privacy policy and terms of use on
 * its authorized domain, and the privacy policy must disclose how the app
 * handles Google user data (see docs/settings-sync.md).
 *
 * Keep them TRUE to the code. If the app starts collecting, storing or
 * contacting something new, the relevant section changes in the same PR and
 * LEGAL_UPDATED moves.
 */

export type LegalLocale = 'en' | 'he' | 'ru';

export interface LegalSection {
  heading: string;
  /** Paragraphs, in order. */
  body: string[];
}

export interface LegalDoc {
  title: string;
  /** One-paragraph summary shown under the title. */
  lede: string;
  sections: LegalSection[];
}

/** ISO date both documents were last changed; rendered per locale. */
export const LEGAL_UPDATED = '2026-07-22';

/** Where users can reach a human — the same channels as the footer. */
export const LEGAL_CONTACT_TELEGRAM = 'https://t.me/benyomin';
export const LEGAL_CONTACT_ISSUES = 'https://github.com/benyaming/zmanim_site/issues';

export const PRIVACY: Record<LegalLocale, LegalDoc> = {
  en: {
    title: 'Privacy',
    lede: 'Zmanim has no user accounts of its own and keeps no database of its users. Everything you configure stays in your browser. Signing in is optional, and all it ever does is move your own settings into an account you already have.',
    sections: [
      {
        heading: 'What is stored on your device',
        body: [
          'Your location (coordinates, timezone, elevation and the name shown for it), which zmanim and opinions you display, any personal dates you add — names, birthdays, weddings, yahrzeits — and your language, theme and accessibility settings are saved in your browser’s local storage.',
          'None of it is sent to a server belonging to this site; the site has no user-data backend at all. Clearing this site’s data in your browser erases every bit of it.',
        ],
      },
      {
        heading: 'Signing in with Google',
        body: [
          'Signing in with Google is optional. When you do, Google gives the site your name, email address and profile picture, and — only if you leave the Drive permission ticked — access to a hidden per-application folder inside your own Google Drive.',
          'Your name, email address and picture are kept in your browser alone, to show which account you are signed in as. Your settings are written as a single file into that hidden folder in your Drive. Because the site has no server of its own, none of this data is ever transmitted to us, stored by us, or shared with anyone else, and it is never used for advertising or sold.',
          'The application folder does not appear among your Drive files, and the permission granted cannot see, read or change any other file in your Drive.',
          'Access tokens last about an hour and are held in memory only — never written to disk. Signing out deletes the stored profile and asks Google to revoke the token. You can also withdraw access at any time under “Manage apps” in your Google Drive settings.',
        ],
      },
      {
        heading: 'Signing in with Telegram',
        body: [
          'Signing in with Telegram is optional. The signed payload Telegram returns is stored in your browser and used to identify you to zmanim_bot, which keeps your settings next to the ones you set in the bot itself.',
          'Disconnecting removes it from your browser, and it stops being accepted 90 days after you signed in.',
        ],
      },
      {
        heading: 'Services the site contacts',
        body: [
          'Searching for a place queries Open-Meteo; turning coordinates into a place name queries BigDataCloud; elevation for a location comes from Open-Meteo. Those requests carry the text you typed or the coordinates being resolved, and are subject to each provider’s own privacy policy.',
          'The “detect my location” button asks your browser for GPS, and only after you allow it. The coordinates stay on your device and are used solely for the lookups above and to compute your times.',
          'Daily-learning entries link to Sefaria; Sefaria is contacted only if you follow such a link.',
        ],
      },
      {
        heading: 'Cookies, analytics and logs',
        body: [
          'The site sets no advertising or tracking cookies and runs no analytics of any kind. One cookie, NEXT_LOCALE, remembers the language you picked.',
          'The web server keeps ordinary access logs (IP address, page requested, browser) for operating and securing the site.',
        ],
      },
      {
        heading: 'Removing your data',
        body: [
          'Sign out of Google or disconnect Telegram to drop the stored credential and stop syncing. Clearing this site’s data in your browser removes everything held on the device.',
          'To delete the settings file from your Drive, remove the app under “Manage apps” in your Google Drive settings — Drive deletes the application folder with it. Telegram-side data is removed through zmanim_bot.',
        ],
      },
      {
        heading: 'Changes and contact',
        body: [
          'If the app ever collects, stores or contacts something new, this page changes with it and the date above moves.',
          'Questions are welcome — reach the author on Telegram or open an issue on GitHub.',
        ],
      },
    ],
  },
  he: {
    title: 'פרטיות',
    lede: 'ל‑Zmanim אין חשבונות משלו ואין מסד נתונים של משתמשים. כל מה שמגדירים נשמר בדפדפן שלכם. ההתחברות היא רשות, וכל תפקידה הוא להעביר את ההגדרות שלכם לחשבון שכבר יש לכם.',
    sections: [
      {
        heading: 'מה נשמר במכשיר שלכם',
        body: [
          'המיקום (נקודות ציון, אזור זמן, גובה והשם המוצג עבורו), הזמנים והשיטות שבחרתם להציג, תאריכים אישיים שהוספתם — שמות, ימי הולדת, נישואין, יום השנה — וכן שפה, ערכת נושא והגדרות נגישות, נשמרים באחסון המקומי של הדפדפן.',
          'שום פרט מזה אינו נשלח לשרת של האתר; לאתר אין כלל שרת לנתוני משתמשים. מחיקת נתוני האתר בדפדפן מוחקת את הכול.',
        ],
      },
      {
        heading: 'התחברות עם Google',
        body: [
          'ההתחברות עם Google היא רשות. כשמתחברים, Google מוסרת לאתר את השם, כתובת הדוא״ל ותמונת הפרופיל — ואם משאירים את ההרשאה ל‑Drive מסומנת, גם גישה לתיקייה נסתרת ייעודית לאפליקציה בתוך ה‑Drive הפרטי שלכם.',
          'השם, הדוא״ל והתמונה נשמרים בדפדפן שלכם בלבד, כדי להציג באיזה חשבון אתם מחוברים. ההגדרות נכתבות כקובץ אחד לאותה תיקייה נסתרת ב‑Drive. מכיוון שלאתר אין שרת משלו, שום נתון מאלה אינו מועבר אלינו, אינו נשמר אצלנו ואינו נמסר לאף גורם אחר; הוא אינו משמש לפרסום ואינו נמכר.',
          'תיקיית האפליקציה אינה מופיעה בין הקבצים שלכם ב‑Drive, וההרשאה שניתנה אינה יכולה לראות, לקרוא או לשנות שום קובץ אחר ב‑Drive.',
          'אסימוני הגישה תקפים כשעה ונשמרים בזיכרון בלבד — לעולם לא לדיסק. יציאה מהחשבון מוחקת את הפרופיל השמור ומבקשת מ‑Google לבטל את האסימון. אפשר גם לשלול את הגישה בכל עת דרך «ניהול אפליקציות» בהגדרות Google Drive.',
        ],
      },
      {
        heading: 'התחברות עם טלגרם',
        body: [
          'ההתחברות עם טלגרם היא רשות. המידע החתום שטלגרם מחזירה נשמר בדפדפן ומשמש לזיהוי מול zmanim_bot, ששומר את ההגדרות שלכם לצד אלה שהגדרתם בבוט עצמו.',
          'ניתוק מסיר אותו מהדפדפן, ותוקפו פג ממילא 90 יום לאחר ההתחברות.',
        ],
      },
      {
        heading: 'שירותים שהאתר פונה אליהם',
        body: [
          'חיפוש מקום פונה ל‑Open-Meteo; המרת נקודות ציון לשם מקום פונה ל‑BigDataCloud; נתוני הגובה מגיעים מ‑Open-Meteo. הפניות האלה כוללות את הטקסט שהקלדתם או את נקודות הציון הנבדקות, וכפופות למדיניות הפרטיות של כל ספק.',
          'כפתור «איתור מיקום» מבקש מהדפדפן את מיקום ה‑GPS, ורק לאחר אישורכם. נקודות הציון נשארות במכשיר ומשמשות רק לפניות שלעיל ולחישוב הזמנים.',
          'פריטי הלימוד היומי מקושרים ל‑Sefaria; פנייה ל‑Sefaria נעשית רק אם לוחצים על קישור כזה.',
        ],
      },
      {
        heading: 'עוגיות, מדידה ויומני שרת',
        body: [
          'האתר אינו מציב עוגיות פרסום או מעקב ואינו מפעיל כלי אנליטיקה כלשהו. עוגייה אחת, NEXT_LOCALE, זוכרת את השפה שבחרתם.',
          'שרת האתר שומר יומני גישה רגילים (כתובת IP, העמוד שהתבקש, סוג הדפדפן) לצורכי תפעול ואבטחה.',
        ],
      },
      {
        heading: 'מחיקת הנתונים',
        body: [
          'יציאה מחשבון Google או ניתוק טלגרם מוחקים את פרטי ההזדהות השמורים ומפסיקים את הסנכרון. מחיקת נתוני האתר בדפדפן מסירה את כל מה ששמור במכשיר.',
          'כדי למחוק את קובץ ההגדרות מה‑Drive, הסירו את האפליקציה תחת «ניהול אפליקציות» בהגדרות Google Drive — Drive מוחק איתה את תיקיית האפליקציה. נתונים בצד טלגרם נמחקים דרך zmanim_bot.',
        ],
      },
      {
        heading: 'שינויים ויצירת קשר',
        body: [
          'אם האפליקציה תתחיל לאסוף, לשמור או לפנות למשהו חדש — העמוד הזה ישתנה בהתאם והתאריך שלמעלה יתעדכן.',
          'שאלות יתקבלו בברכה — אפשר לפנות למפתח בטלגרם או לפתוח issue ב‑GitHub.',
        ],
      },
    ],
  },
  ru: {
    title: 'Конфиденциальность',
    lede: 'У Zmanim нет собственных учётных записей и нет базы данных пользователей. Всё, что вы настраиваете, остаётся в вашем браузере. Вход необязателен и нужен лишь для того, чтобы перенести ваши настройки в аккаунт, который у вас уже есть.',
    sections: [
      {
        heading: 'Что хранится на вашем устройстве',
        body: [
          'Локация (координаты, часовой пояс, высота и отображаемое название), выбранные зманим и мнения, добавленные личные даты — имена, дни рождения, свадьбы, йорцайты — а также язык, тема и настройки доступности сохраняются в локальном хранилище браузера.',
          'Ничего из этого не отправляется на сервер сайта: у сайта вообще нет бэкенда для пользовательских данных. Очистка данных сайта в браузере удаляет всё без остатка.',
        ],
      },
      {
        heading: 'Вход через Google',
        body: [
          'Вход через Google необязателен. При входе Google передаёт сайту ваше имя, адрес электронной почты и фотографию профиля, а также — только если вы оставите отмеченным разрешение для Drive — доступ к скрытой служебной папке приложения в вашем собственном Google Drive.',
          'Имя, почта и фотография хранятся только в вашем браузере, чтобы показать, под каким аккаунтом выполнен вход. Настройки записываются одним файлом в эту скрытую папку в вашем Drive. Поскольку у сайта нет собственного сервера, эти данные никогда не передаются нам, не хранятся у нас и не передаются третьим лицам; они не используются для рекламы и не продаются.',
          'Папка приложения не отображается среди ваших файлов в Drive, а выданное разрешение не позволяет видеть, читать или изменять любой другой файл в вашем Drive.',
          'Токены доступа живут около часа и хранятся только в памяти — никогда на диске. Выход из аккаунта удаляет сохранённый профиль и просит Google отозвать токен. Отозвать доступ можно в любой момент в разделе «Управление приложениями» настроек Google Drive.',
        ],
      },
      {
        heading: 'Вход через Telegram',
        body: [
          'Вход через Telegram необязателен. Подписанные данные, которые возвращает Telegram, сохраняются в браузере и используются для идентификации в zmanim_bot, где ваши настройки хранятся рядом с теми, что заданы в самом боте.',
          'Отключение удаляет их из браузера, и в любом случае они перестают приниматься через 90 дней после входа.',
        ],
      },
      {
        heading: 'Сервисы, к которым обращается сайт',
        body: [
          'Поиск места обращается к Open-Meteo; определение названия по координатам — к BigDataCloud; высота над уровнем моря — к Open-Meteo. Эти запросы содержат введённый текст или проверяемые координаты и подчиняются политикам конфиденциальности соответствующих сервисов.',
          'Кнопка определения местоположения запрашивает у браузера GPS и только после вашего разрешения. Координаты остаются на устройстве и используются лишь для перечисленных запросов и расчёта времён.',
          'Записи ежедневного изучения ссылаются на Sefaria; обращение к Sefaria происходит, только если вы перейдёте по такой ссылке.',
        ],
      },
      {
        heading: 'Файлы cookie, аналитика и логи',
        body: [
          'Сайт не устанавливает рекламных или отслеживающих cookie и не использует никакой аналитики. Единственная cookie, NEXT_LOCALE, запоминает выбранный язык.',
          'Веб-сервер ведёт обычные журналы доступа (IP-адрес, запрошенная страница, браузер) для эксплуатации и защиты сайта.',
        ],
      },
      {
        heading: 'Удаление данных',
        body: [
          'Выход из Google или отключение Telegram удаляет сохранённые учётные данные и прекращает синхронизацию. Очистка данных сайта в браузере убирает всё, что хранится на устройстве.',
          'Чтобы удалить файл настроек из Drive, отключите приложение в разделе «Управление приложениями» настроек Google Drive — Drive удалит вместе с ним папку приложения. Данные на стороне Telegram удаляются через zmanim_bot.',
        ],
      },
      {
        heading: 'Изменения и контакты',
        body: [
          'Если приложение начнёт собирать, хранить или запрашивать что-то новое, эта страница изменится вместе с ним, а дата выше обновится.',
          'Вопросы приветствуются — напишите автору в Telegram или откройте issue на GitHub.',
        ],
      },
    ],
  },
};

export const TERMS: Record<LegalLocale, LegalDoc> = {
  en: {
    title: 'Terms of use',
    lede: 'Zmanim is a free calendar of Jewish prayer times, offered as it is. Using it means accepting what follows.',
    sections: [
      {
        heading: 'The times are informational',
        body: [
          'Zmanim here are computed astronomically for the location you choose. Halachic practice also depends on your community’s custom and on rulings this site cannot make for you.',
          'For anything that turns on an exact time — the start and end of Shabbat and Yom Tov, the beginning and end of a fast, the deadlines for Shema and Tefila — follow your rav and your community’s calendar, not this site.',
        ],
      },
      {
        heading: 'Accuracy',
        body: [
          'Times are computed with the KosherZmanim library and cross-checked against Hebcal, but mistakes remain possible. The result also depends on the coordinates, elevation and timezone in use — check that the location shown is the one you mean.',
          'Some zmanim cannot exist at high latitudes in some seasons. Where that happens the site says so instead of substituting another opinion’s number.',
        ],
      },
      {
        heading: 'No warranty',
        body: [
          'The site is provided “as is”, without warranty of any kind. There is no guarantee that it will be available, uninterrupted or free of errors, and no liability is accepted for any loss arising from its use or from reliance on a time it displays.',
        ],
      },
      {
        heading: 'Your data and your accounts',
        body: [
          'You decide what to put into the app and whether to sync it. Content you add — personal dates and the names attached to them — is yours, and syncing copies it into an account you control.',
          'Signing in with Google or Telegram is also subject to those companies’ own terms and privacy policies.',
        ],
      },
      {
        heading: 'Fair use',
        body: [
          'The site is free for personal use. Please do not attempt to disrupt it, overload it, or use it in a way that degrades it for others. The source code is public on GitHub.',
        ],
      },
      {
        heading: 'Changes and contact',
        body: [
          'These terms may change; the date above shows when they last did. Continuing to use the site after a change means accepting it.',
          'Questions are welcome — reach the author on Telegram or open an issue on GitHub.',
        ],
      },
    ],
  },
  he: {
    title: 'תנאי שימוש',
    lede: 'Zmanim הוא לוח זמנים יהודי חינמי, הניתן כמות שהוא. השימוש בו מהווה הסכמה לאמור להלן.',
    sections: [
      {
        heading: 'הזמנים הם מידע בלבד',
        body: [
          'הזמנים כאן מחושבים חישוב אסטרונומי עבור המיקום שבחרתם. ההלכה למעשה תלויה גם במנהג הקהילה ובהכרעות שהאתר אינו יכול להכריע עבורכם.',
          'בכל דבר התלוי בזמן מדויק — כניסת ויציאת שבת ויום טוב, תחילת התענית וסופה, סוף זמן קריאת שמע ותפילה — יש לנהוג לפי הרב שלכם ולוח הקהילה, ולא לפי אתר זה.',
        ],
      },
      {
        heading: 'דיוק',
        body: [
          'הזמנים מחושבים בעזרת ספריית KosherZmanim ומוצלבים מול Hebcal, אך ייתכנו טעויות. התוצאה תלויה גם בנקודות הציון, בגובה ובאזור הזמן שבשימוש — ודאו שהמיקום המוצג הוא המיקום שהתכוונתם אליו.',
          'בקווי רוחב גבוהים יש עונות שבהן זמנים מסוימים אינם קיימים כלל. במקרה כזה האתר מציין זאת במפורש במקום להציג מספר משיטה אחרת.',
        ],
      },
      {
        heading: 'ללא אחריות',
        body: [
          'האתר ניתן כמות שהוא, ללא אחריות מכל סוג. אין התחייבות לזמינות, לפעילות רציפה או להיעדר שגיאות, ואין אחריות לכל נזק הנובע מהשימוש בו או מהסתמכות על זמן המוצג בו.',
        ],
      },
      {
        heading: 'הנתונים והחשבונות שלכם',
        body: [
          'אתם מחליטים מה להזין לאפליקציה והאם לסנכרן. התוכן שאתם מוסיפים — תאריכים אישיים והשמות המשויכים אליהם — שייך לכם, והסנכרון מעתיק אותו לחשבון שבשליטתכם.',
          'ההתחברות עם Google או עם טלגרם כפופה גם לתנאים ולמדיניות הפרטיות של אותן חברות.',
        ],
      },
      {
        heading: 'שימוש הוגן',
        body: [
          'השימוש באתר חינמי ולצרכים אישיים. נא לא לשבש את פעולתו, להעמיס עליו או להשתמש בו באופן הפוגע באחרים. קוד המקור פתוח ב‑GitHub.',
        ],
      },
      {
        heading: 'שינויים ויצירת קשר',
        body: [
          'התנאים עשויים להשתנות; התאריך שלמעלה מציין מתי עודכנו לאחרונה. המשך השימוש לאחר שינוי מהווה הסכמה לו.',
          'שאלות יתקבלו בברכה — אפשר לפנות למפתח בטלגרם או לפתוח issue ב‑GitHub.',
        ],
      },
    ],
  },
  ru: {
    title: 'Условия использования',
    lede: 'Zmanim — бесплатный календарь еврейских времён молитвы, предоставляемый как есть. Пользуясь им, вы принимаете изложенное ниже.',
    sections: [
      {
        heading: 'Времена носят справочный характер',
        body: [
          'Зманим здесь рассчитываются астрономически для выбранной вами локации. Практическая галаха зависит также от обычая вашей общины и от решений, которые сайт не может принять за вас.',
          'Во всём, что зависит от точного времени — наступление и исход Шабата и Йом Това, начало и конец поста, крайние сроки Шма и Тфилы — следуйте своему раву и календарю общины, а не этому сайту.',
        ],
      },
      {
        heading: 'Точность',
        body: [
          'Времена рассчитываются библиотекой KosherZmanim и сверяются с Hebcal, но ошибки не исключены. Результат зависит также от используемых координат, высоты и часового пояса — проверьте, что показана именно та локация, которую вы имели в виду.',
          'На высоких широтах в некоторые сезоны отдельные зманим не существуют вовсе. В таких случаях сайт прямо об этом сообщает, а не подставляет число из другого мнения.',
        ],
      },
      {
        heading: 'Без гарантий',
        body: [
          'Сайт предоставляется «как есть», без каких-либо гарантий. Не гарантируется его доступность, бесперебойность или отсутствие ошибок; ответственность за убытки, возникшие из-за использования сайта или доверия к показанному времени, не принимается.',
        ],
      },
      {
        heading: 'Ваши данные и аккаунты',
        body: [
          'Вы сами решаете, что вносить в приложение и синхронизировать ли это. Добавляемое вами содержимое — личные даты и связанные с ними имена — принадлежит вам, а синхронизация копирует его в аккаунт, которым управляете вы.',
          'Вход через Google или Telegram дополнительно подчиняется условиям и политикам конфиденциальности этих компаний.',
        ],
      },
      {
        heading: 'Добросовестное использование',
        body: [
          'Сайт бесплатен для личного использования. Пожалуйста, не пытайтесь нарушить его работу, перегрузить его или использовать так, что это ухудшает работу для других. Исходный код открыт на GitHub.',
        ],
      },
      {
        heading: 'Изменения и контакты',
        body: [
          'Условия могут меняться; дата выше показывает, когда это произошло в последний раз. Продолжение использования после изменения означает согласие с ним.',
          'Вопросы приветствуются — напишите автору в Telegram или откройте issue на GitHub.',
        ],
      },
    ],
  },
};
