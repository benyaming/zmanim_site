import { ZmanimZmanimResponseDto } from '@core/zmanim';
import { Language } from '@taiga-ui/i18n/interfaces';

export interface AppStateModel {
  readonly browserTabTitle: string;
  readonly currentLanguage: LanguageModel;
  readonly supportedLanguages: LanguageModel[];
  readonly location: LocationModel | null;
  readonly zmanim: ZmanimModel;
}

export interface LanguageModel {
  name: string;
  direction: string;
  country: string;
  tuiLanguage: Language;
}

export interface LocationModel {
  readonly lat: number;
  readonly lng: number;
  readonly source: 'geoip' | 'navigator' | 'manual';
  readonly cityName: string | null;
}

export type LocationWithoutSourceModel = Omit<LocationModel, 'source'>;

export interface ZmanimModel {
  readonly form: ZmanimFormModel;
  readonly info: ZmanimInfoModel | null;
}

export interface ZmanimFormModel {
  readonly date: Date;
}

export type ZmanimInfoModel = Omit<ZmanimZmanimResponseDto, 'settings'>;
