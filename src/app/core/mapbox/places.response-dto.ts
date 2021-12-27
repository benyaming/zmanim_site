import {Result} from '@mapbox/mapbox-gl-geocoder';

export interface PlacesResponseDto {
  type: string;
  query: number[];
  features: Result[];
  attribution: string;
}
