import { mapBoxTransport } from './mapBoxTransport';

export interface GetPlacesParams {
  lat: number;
  lng: number;
}

const access_token = import.meta.env.VITE_MAPBOX_TOKEN;
console.log('ACCESS_TOKEN', access_token);

export const getPlaces = ({ lat, lng }: GetPlacesParams) =>
  mapBoxTransport({
    method: 'GET',
    url: `/mapbox.places/${lng},${lat}.json`,
    params: {
      access_token,
      language: 'en',
      limit: 1,
    },
  }).then((r) => r.data);
