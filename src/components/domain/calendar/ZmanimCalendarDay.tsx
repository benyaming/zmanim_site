import 'react-calendar/dist/Calendar.css';

import * as KosherZmanim from 'kosher-zmanim';
import { DateTime } from 'luxon';
import React from 'react';
import { CalendarTileProperties } from 'react-calendar';

import { Formatter } from '../../../services/zmanim/formatter';

export const ZmanimCalendarDay = ({ date, view }: CalendarTileProperties): JSX.Element | null => {
  const calendarDate = DateTime.fromJSDate(date);
  const jewishDate = new KosherZmanim.JewishDate(date);
  if (view === 'month') {
    return (
      <div>
        <div>{calendarDate.toLocaleString(DateTime.DATE_MED)}</div>
        <div>{Formatter.format(jewishDate)}</div>
      </div>
    );
  }
  return null;
};
