import styled from '@emotion/styled';
import { Box, Grid } from '@mui/material';
import { JewishDate } from 'kosher-zmanim';
import { times } from 'lodash';
import { DateTime } from 'luxon';
import React from 'react';

import { useZmanim } from '../../../providers/ZmanimProvider';
import { getWeekdays } from '../../../utils';
import { Text } from '../../core/typography';
import { ZmanimCalendarDay } from './ZmanimCalendarDay';

const StyledGrid = styled(Grid)`
  border: 1px solid #e5e5e5;
  border-top: none;
  border-left: none;
  &:nth-of-type(7n) {
    /* your specific styles for every 7th Box component */
    border-right: none;
  }
`;

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
      <Box borderRadius={4} border="1px solid #DCDCE2" borderBottom="none" overflow="hidden">
        <Grid container columns={7}>
          {times(prependDays, (i) => (
            <StyledGrid item xs={1} key={i}>
              <ZmanimCalendarDay
                isOffRange
                onClick={handleDayClick}
                date={firstActiveDay.minus({ days: prependDays - i })}
              />
            </StyledGrid>
          ))}
          {times(getDaysInMonth(), (i) => (
            <StyledGrid item xs={1} key={i}>
              <ZmanimCalendarDay onClick={handleDayClick} date={firstActiveDay.plus({ days: i })} />
            </StyledGrid>
          ))}
          {times(appendDays, (i) => (
            <StyledGrid item xs={1} key={i}>
              <ZmanimCalendarDay
                isOffRange
                onClick={handleDayClick}
                date={firstActiveDay.plus({ days: getDaysInMonth() + i })}
              />
            </StyledGrid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
};
