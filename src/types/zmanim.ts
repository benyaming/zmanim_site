import { OutputMetadata } from 'kosher-zmanim';

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

export interface JsLibZmanimBasicZmanim {
  BeginAstronomicalTwilight: string;
  AlosHashachar: string;
  Alos72: string;
  BeginNauticalTwilight: string;
  BeginCivilTwilight: string;
  SeaLevelSunrise: string;
  Sunrise: string;
  SofZmanShmaMGA: string;
  SofZmanShmaGRA: string;
  SofZmanTfilaMGA: string;
  SofZmanTfilaGRA: string;
  Chatzos: string;
  SunTransit: string;
  MinchaGedola: string;
  MinchaKetana: string;
  PlagHamincha: string;
  CandleLighting: string;
  SeaLevelSunset: string;
  Sunset: string;
  EndCivilTwilight: string;
  Tzais: string;
  EndNauticalTwilight: string;
  Tzais72: string;
  EndAstronomicalTwilight: string;
  ShaahZmanisGra: string;
  TemporalHour: string;
  ShaahZmanisMGA: string;
}

declare module 'kosher-zmanim' {
  interface JsonOutput {
    metadata: OutputMetadata;
    BasicZmanim: JsLibZmanimBasicZmanim;
  }
}
