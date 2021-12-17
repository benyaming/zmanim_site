export interface CoordsModel {
  lat: number;
  lng: number;
  source: 'geoip' | 'navigator' | 'map';
}
