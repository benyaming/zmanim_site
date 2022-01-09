import { ZmanimResponseDto } from '@core/zmanim';

export interface AppStateModel {
  browserTabTitle: string;
  location: LocationModel | null;
  zmanim: ZmanimStateModel;
}

export interface LocationModel {
  lat: number;
  lng: number;
  source: 'geoip' | 'navigator' | 'manual';
  cityName: string | null;
}

export type LocationWithoutSourceModel = Omit<LocationModel, 'source'>;

export interface ZmanimStateModel {
  form: ZmanimFormModel;
  info: ZmanimInfoModel | null;
}

export interface ZmanimFormModel {
  date: Date;
}

export type ZmanimInfoModel = Omit<ZmanimResponseDto, 'settings'>;
