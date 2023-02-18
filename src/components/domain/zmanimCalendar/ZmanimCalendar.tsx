import { Box, Grid } from '@mui/material';
import { JewishDate } from 'kosher-zmanim';
import { times } from 'lodash';
import { DateTime } from 'luxon';
import React from 'react';

import { useZmanim } from '../../../providers/ZmanimProvider';
import { getWeekdays } from '../../../utils';
import { Text } from '../../core/typography';
import { ZmanimCalendarDay } from './ZmanimCalendarDay';

export const ZmanimCalendar = () => {
  const { date, setSelectedDay, isHebrew } = useZmanim();

  const jewishDate = new JewishDate(date);

  const getFirstDay = () => {
    if (isHebrew) {
      jewishDate.setJewishDayOfMonth(1);
      return jewishDate.getDate();
    }
    return date.set({ day: 1 });
  };

  const getAppendDays = () => {
    if (isHebrew) {
      return 35 - jewishDate.getDaysInJewishMonth() - prependDays;
    }
    return 35 - date.daysInMonth - prependDays;
  };

  const getDaysInMonth = () => {
    if (isHebrew) {
      return jewishDate.getDaysInJewishMonth();
    }
    return date.daysInMonth;
  };

  // get the first day of active month
  const firstActiveDay = getFirstDay();

  const prependDays = firstActiveDay.weekday === 7 ? 0 : firstActiveDay.weekday;
  const appendDays = getAppendDays();

  const handleDayClick = (date: DateTime) => setSelectedDay(date);
  return (
    <Box>
      <Grid container columns={7}>
        {getWeekdays().map((d) => (
          <Grid item key={d} xs={1}>
            <Box px={2}>
              <Text fontWeight="500">{d}</Text>
            </Box>
          </Grid>
        ))}
      </Grid>
      <Grid container columns={7} borderRadius={4} border="1px solid #DCDCE2" borderBottom="none" borderRight="none">
        {times(prependDays, (i) => (
          <Grid item xs={1} key={i}>
            <ZmanimCalendarDay
              isOffRange
              onClick={handleDayClick}
              date={firstActiveDay.minus({ days: prependDays - i })}
            />
          </Grid>
        ))}
        {times(getDaysInMonth(), (i) => (
          <Grid item xs={1} key={i}>
            <ZmanimCalendarDay onClick={handleDayClick} date={firstActiveDay.plus({ days: i })} />
          </Grid>
        ))}
        {times(appendDays, (i) => (
          <Grid item xs={1} key={i}>
            <ZmanimCalendarDay
              isOffRange
              onClick={handleDayClick}
              date={firstActiveDay.plus({ days: getDaysInMonth() + i })}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};
