/**
 * Curated index of Israeli settlements in Judea & Samaria (plus the adjacent
 * localities most affected), bundled locally because the external geocoders
 * fail on them:
 *
 * - Open-Meteo's GeoNames index misses most of them, does no fuzzy matching
 *   (it has "Modiin Ilit" but not "Modiin Illit"), and has no Hebrew/Russian
 *   entries for them.
 * - BigDataCloud's reverse geocoder labels users there with neighboring
 *   Palestinian cities ("Ramallah" for Psagot / Kochav Yaakov).
 *
 * Coordinates were sourced from OpenStreetMap (locality centers; a few hundred
 * meters of drift is negligible for zmanim). Names follow the transliteration
 * conventions shared with the companion zmanim_bot project.
 */

export interface Settlement {
  slug: string;
  lat: number;
  lng: number;
  names: { en: string; he: string; ru: string };
  /** Alternate spellings / transliterations (any language), matched after normalization. */
  aliases?: string[];
}

export const SETTLEMENTS: readonly Settlement[] = [
  { slug: 'modiin-illit', lat: 31.9324, lng: 35.0433, names: { en: "Modi'in Illit", he: 'מודיעין עילית', ru: 'Модиин-Илит' }, aliases: ['kiryat sefer', 'קרית ספר', 'modiin ilit'] },
  { slug: 'beitar-illit', lat: 31.7019, lng: 35.1073, names: { en: 'Beitar Illit', he: 'ביתר עילית', ru: 'Бейтар-Илит' }, aliases: ['betar illit', 'betar ilit', 'beitar ilit'] },
  { slug: 'maale-adumim', lat: 31.7706, lng: 35.2987, names: { en: "Ma'ale Adumim", he: 'מעלה אדומים', ru: 'Маале-Адумим' } },
  { slug: 'ariel', lat: 32.1061, lng: 35.1851, names: { en: 'Ariel', he: 'אריאל', ru: 'Ариэль' } },
  { slug: 'givat-zeev', lat: 31.8623, lng: 35.1687, names: { en: "Giv'at Ze'ev", he: 'גבעת זאב', ru: 'Гиват-Зеэв' } },
  { slug: 'efrat', lat: 31.6536, lng: 35.1509, names: { en: 'Efrat', he: 'אפרת', ru: 'Эфрат' }, aliases: ['efrata'] },
  { slug: 'kiryat-arba', lat: 31.5278, lng: 35.1192, names: { en: 'Kiryat Arba', he: 'קריית ארבע', ru: 'Кирьят-Арба' }, aliases: ['qiryat arba'] },
  { slug: 'alfei-menashe', lat: 32.1745, lng: 35.009, names: { en: 'Alfei Menashe', he: 'אלפי מנשה', ru: 'Альфей-Менаше' }, aliases: ['alfe menashe'] },
  { slug: 'oranit', lat: 32.1309, lng: 34.992, names: { en: 'Oranit', he: 'אורנית', ru: 'Оранит' } },
  { slug: 'karnei-shomron', lat: 32.1722, lng: 35.0978, names: { en: 'Karnei Shomron', he: 'קרני שומרון', ru: 'Карней-Шомрон' }, aliases: ['karney shomron'] },
  { slug: 'kedumim', lat: 32.2119, lng: 35.1511, names: { en: 'Kedumim', he: 'קדומים', ru: 'Кдумим' }, aliases: ['kdumim', 'qedumim'] },
  { slug: 'beit-el', lat: 31.9421, lng: 35.2224, names: { en: 'Beit El', he: 'בית אל', ru: 'Бейт-Эль' }, aliases: ['bet el'] },
  { slug: 'kochav-yaakov', lat: 31.8814, lng: 35.2453, names: { en: 'Kochav Yaakov', he: 'כוכב יעקב', ru: 'Кохав-Яаков' }, aliases: ['kokhav yaakov', 'tel zion', 'תל ציון'] },
  { slug: 'elkana', lat: 32.1116, lng: 35.0355, names: { en: 'Elkana', he: 'אלקנה', ru: 'Элькана' }, aliases: ['elqana'] },
  { slug: 'shaarei-tikva', lat: 32.1206, lng: 35.0293, names: { en: "Sha'arei Tikva", he: 'שערי תקוה', ru: 'Шаарей-Тиква' } },
  { slug: 'immanuel', lat: 32.1619, lng: 35.1361, names: { en: 'Immanuel', he: 'עמנואל', ru: 'Иммануэль' }, aliases: ['emanuel', 'emmanuel'] },
  { slug: 'har-adar', lat: 31.8269, lng: 35.1296, names: { en: 'Har Adar', he: 'הר אדר', ru: 'Хар-Адар' } },
  { slug: 'tekoa', lat: 31.6533, lng: 35.2293, names: { en: 'Tekoa', he: 'תקוע', ru: 'Ткоа' }, aliases: ['tkoa'] },
  { slug: 'neve-daniel', lat: 31.6762, lng: 35.1428, names: { en: 'Neve Daniel', he: 'נווה דניאל', ru: 'Неве-Даниэль' } },
  { slug: 'elazar', lat: 31.6607, lng: 35.1415, names: { en: 'Elazar', he: 'אלעזר', ru: 'Эльазар' } },
  { slug: 'alon-shvut', lat: 31.6549, lng: 35.1268, names: { en: 'Alon Shvut', he: 'אלון שבות', ru: 'Алон-Швут' } },
  { slug: 'kfar-etzion', lat: 31.6487, lng: 35.115, names: { en: 'Kfar Etzion', he: 'כפר עציון', ru: 'Кфар-Эцион' } },
  { slug: 'rosh-tzurim', lat: 31.6676, lng: 35.1253, names: { en: 'Rosh Tzurim', he: 'ראש צורים', ru: 'Рош-Цурим' } },
  { slug: 'migdal-oz', lat: 31.6397, lng: 35.1426, names: { en: 'Migdal Oz', he: 'מגדל עוז', ru: 'Мигдаль-Оз' } },
  { slug: 'bat-ayin', lat: 31.6573, lng: 35.1032, names: { en: 'Bat Ayin', he: 'בת עין', ru: 'Бат-Аин' } },
  { slug: 'karmei-tzur', lat: 31.6092, lng: 35.1009, names: { en: 'Karmei Tzur', he: 'כרמי צור', ru: 'Кармей-Цур' } },
  { slug: 'nokdim', lat: 31.645, lng: 35.2441, names: { en: 'Nokdim', he: 'נוקדים', ru: 'Нокдим' } },
  { slug: 'kfar-adumim', lat: 31.8253, lng: 35.3352, names: { en: 'Kfar Adumim', he: 'כפר אדומים', ru: 'Кфар-Адумим' } },
  { slug: 'mitzpe-yericho', lat: 31.8155, lng: 35.3943, names: { en: 'Mitzpe Yericho', he: 'מצפה יריחו', ru: 'Мицпе-Иерихо' }, aliases: ['mitspe yeriho', 'mitzpe yeriho'] },
  { slug: 'almon', lat: 31.8316, lng: 35.2965, names: { en: 'Almon', he: 'עלמון', ru: 'Альмон' }, aliases: ['anatot', 'ענתות'] },
  { slug: 'maale-michmas', lat: 31.879, lng: 35.3062, names: { en: "Ma'ale Michmas", he: 'מעלה מכמש', ru: 'Маале-Михмас' }, aliases: ['maale michmash', 'maale mikhmash', 'maale mikhmas'] },
  { slug: 'kochav-hashachar', lat: 31.9603, lng: 35.3495, names: { en: 'Kochav HaShachar', he: 'כוכב השחר', ru: 'Кохав-ха-Шахар' }, aliases: ['kokhav hashahar'] },
  { slug: 'ofra', lat: 31.9535, lng: 35.2605, names: { en: 'Ofra', he: 'עפרה', ru: 'Офра' } },
  { slug: 'psagot', lat: 31.8987, lng: 35.2241, names: { en: 'Psagot', he: 'פסגות', ru: 'Псагот' } },
  { slug: 'shilo', lat: 32.0552, lng: 35.2995, names: { en: 'Shilo', he: 'שילה', ru: 'Шило' }, aliases: ['shiloh'] },
  { slug: 'eli', lat: 32.0695, lng: 35.2625, names: { en: 'Eli', he: 'עלי', ru: 'Эли' } },
  { slug: 'maale-levona', lat: 32.055, lng: 35.2403, names: { en: "Ma'ale Levona", he: 'מעלה לבונה', ru: 'Маале-Левона' } },
  { slug: 'talmon', lat: 31.9394, lng: 35.1323, names: { en: 'Talmon', he: 'טלמון', ru: 'Тальмон' } },
  { slug: 'dolev', lat: 31.9262, lng: 35.1351, names: { en: 'Dolev', he: 'דולב', ru: 'Долев' } },
  { slug: 'halamish', lat: 32.0063, lng: 35.1269, names: { en: 'Halamish', he: 'חלמיש', ru: 'Халамиш' }, aliases: ['neve tzuf', 'neve tsuf', 'נווה צוף'] },
  { slug: 'ateret', lat: 32.0005, lng: 35.1766, names: { en: 'Ateret', he: 'עטרת', ru: 'Атерет' } },
  { slug: 'nili', lat: 31.964, lng: 35.0472, names: { en: 'Nili', he: 'ניל"י', ru: 'Нили' } },
  { slug: 'naale', lat: 31.963, lng: 35.0646, names: { en: "Na'ale", he: 'נעלה', ru: 'Наале' } },
  { slug: 'beit-arye', lat: 32.0408, lng: 35.0496, names: { en: 'Beit Aryeh', he: 'בית אריה', ru: 'Бейт-Арье' }, aliases: ['beit arye', 'ofarim', 'עופרים'] },
  { slug: 'peduel', lat: 32.0618, lng: 35.0532, names: { en: 'Peduel', he: 'פדואל', ru: 'Педуэль' } },
  { slug: 'alei-zahav', lat: 32.0711, lng: 35.0634, names: { en: 'Alei Zahav', he: 'עלי זהב', ru: 'Алей-Захав' }, aliases: ['alay zahav', 'leshem', 'לשם'] },
  { slug: 'barkan', lat: 32.1066, lng: 35.1066, names: { en: 'Barkan', he: 'ברקן', ru: 'Баркан' } },
  { slug: 'revava', lat: 32.1191, lng: 35.1276, names: { en: 'Revava', he: 'רבבה', ru: 'Ревава' } },
  { slug: 'kiryat-netafim', lat: 32.1165, lng: 35.1127, names: { en: 'Kiryat Netafim', he: 'קריית נטפים', ru: 'Кирьят-Нетафим' } },
  { slug: 'yakir', lat: 32.1494, lng: 35.1145, names: { en: 'Yakir', he: 'יקיר', ru: 'Якир' } },
  { slug: 'nofim', lat: 32.1553, lng: 35.1009, names: { en: 'Nofim', he: 'נופים', ru: 'Нофим' } },
  { slug: 'maale-shomron', lat: 32.1659, lng: 35.0707, names: { en: "Ma'ale Shomron", he: 'מעלה שומרון', ru: 'Маале-Шомрон' } },
  { slug: 'tzofim', lat: 32.1982, lng: 35.0097, names: { en: 'Tzofim', he: 'צופים', ru: 'Цофим' }, aliases: ['tzufim', 'tsofim'] },
  { slug: 'salit', lat: 32.2428, lng: 35.0508, names: { en: "Sal'it", he: 'סלעית', ru: 'Салит' } },
  { slug: 'avnei-hefetz', lat: 32.2847, lng: 35.0736, names: { en: 'Avnei Hefetz', he: 'אבני חפץ', ru: 'Авней-Хефец' }, aliases: ['avnei hefets'] },
  { slug: 'einav', lat: 32.2847, lng: 35.1264, names: { en: 'Einav', he: 'עינב', ru: 'Эйнав' }, aliases: ['enav'] },
  { slug: 'shavei-shomron', lat: 32.2632, lng: 35.1848, names: { en: 'Shavei Shomron', he: 'שבי שומרון', ru: 'Шавей-Шомрон' }, aliases: ['shaveh shomron'] },
  { slug: 'har-bracha', lat: 32.1924, lng: 35.2651, names: { en: 'Har Bracha', he: 'הר ברכה', ru: 'Хар-Браха' }, aliases: ['bracha', 'har beracha'] },
  { slug: 'yitzhar', lat: 32.1686, lng: 35.2338, names: { en: 'Yitzhar', he: 'יצהר', ru: 'Ицхар' }, aliases: ['itzhar'] },
  { slug: 'itamar', lat: 32.1745, lng: 35.3084, names: { en: 'Itamar', he: 'איתמר', ru: 'Итамар' } },
  { slug: 'elon-moreh', lat: 32.2357, lng: 35.3316, names: { en: 'Elon Moreh', he: 'אלון מורה', ru: 'Элон-Море' } },
  { slug: 'kfar-tapuach', lat: 32.1191, lng: 35.2501, names: { en: 'Kfar Tapuach', he: 'כפר תפוח', ru: 'Кфар-Тапуах' }, aliases: ['tapuach', 'kfar tapuah'] },
  { slug: 'rechelim', lat: 32.1028, lng: 35.257, names: { en: 'Rechelim', he: 'רחלים', ru: 'Рехелим' }, aliases: ['rehelim'] },
  { slug: 'migdalim', lat: 32.0899, lng: 35.3423, names: { en: 'Migdalim', he: 'מגדלים', ru: 'Мигдалим' } },
  { slug: 'maale-efraim', lat: 32.0708, lng: 35.4034, names: { en: "Ma'ale Efraim", he: 'מעלה אפרים', ru: 'Маале-Эфраим' }, aliases: ['maale efrayim'] },
  { slug: 'hashmonaim', lat: 31.9312, lng: 35.0224, names: { en: 'Hashmonaim', he: 'חשמונאים', ru: 'Хашмонаим' }, aliases: ['chashmonaim'] },
  { slug: 'mattityahu', lat: 31.9299, lng: 35.0346, names: { en: 'Mattityahu', he: 'מתתיהו', ru: 'Матитьяху' }, aliases: ['matityahu'] },
  { slug: 'kfar-haoranim', lat: 31.9198, lng: 35.0369, names: { en: 'Kfar HaOranim', he: 'כפר האורנים', ru: 'Кфар-ха-Ораним' }, aliases: ['menora', 'מנורה'] },
  { slug: 'mevo-horon', lat: 31.8502, lng: 35.0355, names: { en: 'Mevo Horon', he: 'מבוא חורון', ru: 'Мево-Хорон' } },
  { slug: 'beit-horon', lat: 31.8784, lng: 35.1263, names: { en: 'Beit Horon', he: 'בית חורון', ru: 'Бейт-Хорон' } },
  { slug: 'givon-hahadasha', lat: 31.8482, lng: 35.1576, names: { en: 'Givon HaHadasha', he: 'גבעון החדשה', ru: 'Гивон-ха-Хадаша' }, aliases: ['new givon'] },
  { slug: 'geva-binyamin', lat: 31.8503, lng: 35.274, names: { en: 'Geva Binyamin', he: 'גבע בנימין (אדם)', ru: 'Гева-Биньямин' }, aliases: ['adam', 'אדם'] },
  { slug: 'hermesh', lat: 32.4232, lng: 35.1188, names: { en: 'Hermesh', he: 'חרמש', ru: 'Хермеш' } },
  { slug: 'mevo-dotan', lat: 32.4207, lng: 35.1748, names: { en: 'Mevo Dotan', he: 'מבוא דותן', ru: 'Мево-Дотан' } },
  { slug: 'hinanit', lat: 32.4807, lng: 35.1735, names: { en: 'Hinanit', he: 'חיננית', ru: 'Хинанит' } },
  { slug: 'shaked', lat: 32.4737, lng: 35.1686, names: { en: 'Shaked', he: 'שקד', ru: 'Шакед' } },
  { slug: 'otniel', lat: 31.439, lng: 35.0289, names: { en: 'Otniel', he: 'עתניאל', ru: 'Отниэль' } },
  { slug: 'susya', lat: 31.3919, lng: 35.1135, names: { en: 'Susya', he: 'סוסיה', ru: 'Сусия' }, aliases: ['susiya'] },
  { slug: 'beit-hagai', lat: 31.4934, lng: 35.0804, names: { en: 'Beit Hagai', he: 'בית חגי', ru: 'Бейт-Хагай' } },
  { slug: 'adora', lat: 31.5519, lng: 35.0165, names: { en: 'Adora', he: 'אדורה', ru: 'Адора' } },
  { slug: 'telem', lat: 31.5635, lng: 35.031, names: { en: 'Telem', he: 'תלם', ru: 'Телем' } },
  { slug: 'eshkolot', lat: 31.3912, lng: 34.9047, names: { en: 'Eshkolot', he: 'אשכולות', ru: 'Эшколот' } },
  { slug: 'sansana', lat: 31.3629, lng: 34.9034, names: { en: 'Sansana', he: 'סנסנה', ru: 'Сансана' } },
  { slug: 'maale-amos', lat: 31.5963, lng: 35.2281, names: { en: "Ma'ale Amos", he: 'מעלה עמוס', ru: 'Маале-Амос' } },
  { slug: 'kfar-eldad', lat: 31.6541, lng: 35.2509, names: { en: 'Kfar Eldad', he: 'כפר אלדד', ru: 'Кфар-Эльдад' } },
];

/** Localized country label for search-result descriptions. */
export const ISRAEL_LABEL: Record<string, string> = { en: 'Israel', he: 'ישראל', ru: 'Израиль' };

export function settlementName(s: Settlement, language: string): string {
  return s.names[language as keyof Settlement['names']] ?? s.names.en;
}

/**
 * Case-, apostrophe- and diacritic-insensitive key so "Modi'in Illit",
 * "modiin illit" and "Giv'at Ze'ev" all match user input typed without
 * punctuation. Also strips Hebrew niqqud and geresh/gershayim (ניל"י → נילי).
 */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u05b0-\u05c7]/g, '')
    .replace(/['‘’`׳״"]/g, '')
    .replace(/[-_.,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const INDEX = SETTLEMENTS.map((s) => ({
  s,
  keys: [s.names.en, s.names.he, s.names.ru, ...(s.aliases ?? [])].map(normalizeName),
}));

/**
 * Autocomplete-style local search: a settlement matches when the query is a
 * prefix of any known name/alias, or of any word inside one ("adumim" finds
 * Ma'ale Adumim). Full-name prefix matches rank first; within a tier the
 * dataset's rough population order is kept.
 */
export function searchSettlements(query: string, limit = 6): Settlement[] {
  const q = normalizeName(query);
  if (q.length < 2) return [];
  const full: Settlement[] = [];
  const word: Settlement[] = [];
  for (const { s, keys } of INDEX) {
    if (keys.some((k) => k.startsWith(q))) full.push(s);
    else if (keys.some((k) => k.split(' ').some((w) => w.startsWith(q)))) word.push(s);
  }
  return [...full, ...word].slice(0, limit);
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** The closest settlement within `maxKm`, or null. Linear scan — the list is tiny. */
export function nearestSettlement(lat: number, lng: number, maxKm: number): Settlement | null {
  let best: Settlement | null = null;
  let bestKm = maxKm;
  for (const s of SETTLEMENTS) {
    const d = haversineKm(lat, lng, s.lat, s.lng);
    if (d <= bestKm) {
      best = s;
      bestKm = d;
    }
  }
  return best;
}
