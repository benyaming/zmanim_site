import { ZmanimZmanimResponseDto } from '@core/zmanim';

export interface AppStateModel {
  readonly browserTabTitle: string;
  readonly currentLanguage: string;
  readonly supportedLanguages: string[];
  readonly location: LocationModel | null;
  readonly zmanim: ZmanimStateModel;
}

export interface LocationModel {
  readonly lat: number;
  readonly lng: number;
  readonly source: 'geoip' | 'navigator' | 'manual';
  readonly cityName: string | null;
}

export type LocationWithoutSourceModel = Omit<LocationModel, 'source'>;

export interface ZmanimStateModel {
  readonly form: ZmanimFormModel;
  readonly info: ZmanimInfoModel | null;
}

export interface ZmanimFormModel {
  readonly date: Date;
}

export type ZmanimInfoModel = Omit<ZmanimZmanimResponseDto, 'settings'>;
