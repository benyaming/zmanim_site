import { JewishCalendar, JewishDate } from 'kosher-zmanim';

export enum SignificantDaysEnum {
  EREV_PESACH,
  PESACH,
  CHOL_HAMOED_PESACH,
  PESACH_SHENI,
  EREV_SHAVUOS,
  SHAVUOS,
  SEVENTEEN_OF_TAMMUZ,
  TISHA_BEAV,
  TU_BEAV,
  EREV_ROSH_HASHANA,
  ROSH_HASHANA,
  FAST_OF_GEDALYAH,
  EREV_YOM_KIPPUR,
  YOM_KIPPUR,
  EREV_SUCCOS,
  SUCCOS,
  CHOL_HAMOED_SUCCOS,
  HOSHANA_RABBA,
  SHEMINI_ATZERES,
  SIMCHAS_TORAH,
  CHANUKAH,
  TENTH_OF_TEVES,
  TU_BESHVAT,
  FAST_OF_ESTHER,
  PURIM,
  SHUSHAN_PURIM,
  PURIM_KATAN,
  ROSH_CHODESH,
  YOM_HASHOAH,
  YOM_HAZIKARON,
  YOM_HAATZMAUT,
  YOM_YERUSHALAYIM,
  LAG_BAOMER,
  SHUSHAN_PURIM_KATAN,
}

export interface SignificantDay {
  name: keyof typeof SignificantDaysEnum;
  isHoliday: boolean;
}

export const getSignificantDay = (day: number) => {
  if (day < 0) return 0;
  const days: SignificantDay[] = [
    { name: 'EREV_PESACH', isHoliday: false },
    { name: 'PESACH', isHoliday: false },
    { name: 'CHOL_HAMOED_PESACH', isHoliday: false },
    { name: 'PESACH_SHENI', isHoliday: true }, // holiday
    { name: 'EREV_SHAVUOS', isHoliday: false },
    { name: 'SHAVUOS', isHoliday: false },
    { name: 'SEVENTEEN_OF_TAMMUZ', isHoliday: false },
    { name: 'TISHA_BEAV', isHoliday: false },
    { name: 'TU_BEAV', isHoliday: true }, // holiday
    { name: 'EREV_ROSH_HASHANA', isHoliday: false },
    { name: 'ROSH_HASHANA', isHoliday: false },
    { name: 'FAST_OF_GEDALYAH', isHoliday: false },
    { name: 'EREV_YOM_KIPPUR', isHoliday: false },
    { name: 'YOM_KIPPUR', isHoliday: false },
    { name: 'EREV_SUCCOS', isHoliday: false },
    { name: 'SUCCOS', isHoliday: false },
    { name: 'CHOL_HAMOED_SUCCOS', isHoliday: false },
    { name: 'HOSHANA_RABBA', isHoliday: false },
    { name: 'SHEMINI_ATZERES', isHoliday: false },
    { name: 'SIMCHAS_TORAH', isHoliday: false },
    { name: 'CHANUKAH', isHoliday: true }, // holiday
    { name: 'TENTH_OF_TEVES', isHoliday: false },
    { name: 'TU_BESHVAT', isHoliday: true }, // holiday
    { name: 'FAST_OF_ESTHER', isHoliday: false },
    { name: 'PURIM', isHoliday: true }, // holiday
    { name: 'SHUSHAN_PURIM', isHoliday: true }, // holiday
    { name: 'PURIM_KATAN', isHoliday: true }, // holiday
    { name: 'ROSH_CHODESH', isHoliday: false },
    { name: 'YOM_HASHOAH', isHoliday: true }, // holiday
    { name: 'YOM_HAZIKARON', isHoliday: true }, // holiday
    { name: 'YOM_HAATZMAUT', isHoliday: true }, // holiday
    { name: 'YOM_YERUSHALAYIM', isHoliday: true }, // holiday
    { name: 'LAG_BAOMER', isHoliday: true }, // holiday
    { name: 'SHUSHAN_PURIM_KATAN', isHoliday: true }, // holiday
  ];
  return days[day];
};

export const getDayTags = (jewDate: JewishDate, jewCalendar: JewishCalendar) => {};

export const isCorner = (index: number, pos: 'top' | 'bottom') => {
  if (pos === 'top') {
    if (index === 0) return 'topLeft';
    if (index === 6) return 'topRight';
  }
  if (pos === 'bottom') {
    if (index === 0) return 'bottomRight';
    if (index === 6) return 'bottomLeft';
  }
  return undefined;
};
