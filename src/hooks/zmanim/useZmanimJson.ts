import ts from '@mapbox/timespace';
import { JsonOutput } from 'kosher-zmanim';
import { useQuery } from 'react-query';

import { RQ_QUERY_ZMANIM_JSON } from '../../constants/queries';
import { zmanimJson } from '../../services/zmanim/ZmanimJson';

export interface ZmanimJsonQueryOptions {
  lat: number;
  lng: number;
  timestamp: number;
}
export const useZmanimJson = ({ lat, lng, timestamp }: ZmanimJsonQueryOptions) => {
  const timeZone = ts.getFuzzyLocalTimeFromPoint(timestamp, [lat, lng]);

  return useQuery<JsonOutput>(
    [RQ_QUERY_ZMANIM_JSON, lat, lng, timeZone?._z.name, timestamp],
    () => zmanimJson({ timeZoneId: timeZone?._z.name, date: timestamp, elevation: 0, latitude: lat, longitude: lng }),
    { enabled: Boolean(timeZone) && Boolean(timestamp) },
  );
};
