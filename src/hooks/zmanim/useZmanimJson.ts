import ts from '@mapbox/timespace';
import { useQuery } from '@tanstack/react-query';
import { JsonOutput } from 'kosher-zmanim';
import { DateTime } from 'luxon';

import { RQ_QUERY_ZMANIM_JSON } from '../../constants/queries';
import { zmanimJson } from '../../services/zmanim/ZmanimJson';

export interface ZmanimJsonQueryOptions {
  lat: number;
  lng: number;
  date: DateTime;
}

export const useZmanimJson = ({ lat, lng, date }: ZmanimJsonQueryOptions) => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const timeZone = ts.getFuzzyLocalTimeFromPoint(date.toMillis(), [lat, lng]);
  return useQuery<JsonOutput>(
    [RQ_QUERY_ZMANIM_JSON, lat, lng, timeZone?._z.name, date],
    () => zmanimJson({ timeZoneId: timeZone?._z.name, date, elevation: 0, latitude: lat, longitude: lng }),
    { enabled: Boolean(timeZone) && Boolean(date) },
  );
};
