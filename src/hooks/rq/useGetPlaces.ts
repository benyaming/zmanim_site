import { useQuery, UseQueryOptions } from '@tanstack/react-query';

import { RQ_QUERY_GET_PLACES } from '../../constants/queries';
import i18n from '../../i18n';
import { getPlaces, MapboxResponseDto } from '../../services/http/mapBox/resources';
import { Coords } from '../../types/geo';

export const useGetPlaces = (latLng: Coords, options: UseQueryOptions<MapboxResponseDto> = {}) =>
  useQuery<MapboxResponseDto>([RQ_QUERY_GET_PLACES, i18n.language, latLng?.lat, latLng?.lng], () => getPlaces(latLng), {
    enabled: Boolean(latLng.lat && latLng.lng),
    refetchOnWindowFocus: false,
    ...options,
  });
