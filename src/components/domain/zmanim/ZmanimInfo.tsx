import { pick } from 'lodash';
import map from 'lodash/map';
import { DateTime } from 'luxon';
import React, { useState } from 'react';

import { ZMANIM_KEYS } from '../../../constants/common';
import { useCalendar } from '../../../providers/CalendarProvide';
import { ZmanimInfoFilters } from './ZmanimInfoFilters';

export const ZmanimInfo = () => {
  const { zmanimJson } = useCalendar();
  const [show, setShow] = useState(ZMANIM_KEYS);
  const handleFilters = (val: { [key: string]: boolean }) => {
    setShow(Object.keys(val).filter((k) => val[k]));
  };
  return (
    <div>
      <ZmanimInfoFilters handleFormSubmit={handleFilters} />
      {map(
        pick(
          zmanimJson?.BasicZmanim,
          show.map((i) => i),
        ),
        (value, key) => (
          <div key={key}>
            <span>{key}</span>: <span>{DateTime.fromISO(value!).toFormat('HH:mm')}</span>
          </div>
        ),
      )}
    </div>
  );
};
