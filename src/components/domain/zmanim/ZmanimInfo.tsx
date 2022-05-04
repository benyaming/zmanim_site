import ts from '@mapbox/timespace';
import { format, getDate } from 'date-fns';
import { JsonOutput } from 'kosher-zmanim';
import { pick } from 'lodash';
import map from 'lodash/map';
import { DateTime } from 'luxon';
import React from 'react';
import { useQuery } from 'react-query';

import { RQ_QUERY_ZMANIM_JSON } from '../../../constants/queries';
import { useGeolocation } from '../../../providers/GeoProvider';
import { zmanimJson } from '../../../services/zmanim/ZmanimJson';

export interface ZmanimInfoProps {
  timestamp: number;
}

export const ZmanimInfo = (props: ZmanimInfoProps) => {
  const { timestamp } = props;
  if (!timestamp) return <></>;
  const {
    latLng: { lat, lng },
  } = useGeolocation();
  const timeZone = ts.getFuzzyLocalTimeFromPoint(timestamp, [lat, lng]);

  const { data } = useQuery<JsonOutput>(
    [RQ_QUERY_ZMANIM_JSON, lat, lng, timeZone?._z.name, timestamp],
    () => zmanimJson({ timeZoneId: timeZone?._z.name, date: timestamp, elevation: 0, latitude: lat, longitude: lng }),
    { enabled: Boolean(timeZone) },
  );

  return (
    <div>
      {map(pick(data?.BasicZmanim, ['Sunrise', 'Sunset', 'AlosHashachar', 'CandleLighting']), (value, key) => (
        <div key={key}>
          <span>{key}</span>: <span>{DateTime.fromISO(value!).toFormat('HH:mm')}</span>
        </div>
      ))}
    </div>
  );
};
