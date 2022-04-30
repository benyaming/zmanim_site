import { AxiosResponse } from 'axios';

import i18n from '../../../i18n';
import { mapBoxTransport } from './mapBoxTransport';

export interface GetPlacesParams {
  lat: number;
  lng: number;
}

export interface MapBoxContetnItem {
  id: string;
  language: string;
  text: string;
  wikidata: string;
  short_code?: string;
}

export interface MapboxFeature {
  center: [number, number];
  context: MapBoxContetnItem[];
  geometry: {
    type: string;
    coordinates: [number, number];
  };
  id: string;
  place_name: string;
  type: string;
}

export interface MapboxResponseDto {
  attribution: string;
  type: string;
  features: MapboxFeature[];
  query: [number, number];
}

const access_token = import.meta.env.VITE_MAPBOX_TOKEN;

export const getPlaces = ({ lat, lng }: GetPlacesParams): Promise<MapboxResponseDto> =>
  mapBoxTransport({
    method: 'GET',
    url: `/mapbox.places/${lng},${lat}.json`,
    params: {
      access_token,
      language: i18n.language,
      limit: 1,
    },
  }).then((r: AxiosResponse<MapboxResponseDto>) => r.data);
