import { Map } from 'mapbox-gl';

export interface MapboxClickEvent {
  lngLat: { lng: number; lat: number };
  point: { x: number; y: number };
  type: 'click';
  target: Map;
}
