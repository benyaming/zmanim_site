import { Result } from '@mapbox/mapbox-gl-geocoder';

export interface MapboxPlacesResponseDto {
  readonly type: string;
  readonly query: number[];
  readonly features: Result[];
  readonly attribution: string;
}
