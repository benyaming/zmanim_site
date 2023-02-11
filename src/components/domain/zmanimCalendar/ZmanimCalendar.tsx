import { Box, Grid } from '@mui/material';
import { times } from 'lodash';
import { DateTime } from 'luxon';
import React from 'react';

import { useZmanim } from '../../../providers/ZmanimProvider';
import { getWeekdays } from '../../../utils';
import { Text } from '../../core/typography';
import { ZmanimCalendarDay } from './ZmanimCalendarDay';

export const ZmanimCalendar = () => {
  const { date, setSelectedDay } = useZmanim();

  // get the first day of active month
  const firstActiveDay = date.set({ day: 1 });

  //get the first day to display in calendar grid
  const firstDisplayDay = firstActiveDay.minus({ days: firstActiveDay.weekday });

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
        {times(35, (i) => (
          <Grid item xs={1} key={i}>
            <ZmanimCalendarDay onClick={handleDayClick} date={firstDisplayDay.plus({ days: i })} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};
