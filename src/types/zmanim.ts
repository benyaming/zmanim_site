import { OutputMetadata } from 'kosher-zmanim';

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
