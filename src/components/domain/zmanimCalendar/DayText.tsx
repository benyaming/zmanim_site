import { Box } from '@mui/material';
import { HebrewDateFormatter, JewishCalendar } from 'kosher-zmanim';
import { DateTime } from 'luxon';
import React from 'react';

import { useZmanim } from '../../../providers/ZmanimProvider';
import { Text } from '../../core/typography';

export interface DayTextProps {
  date: DateTime;
  jewishCalendar: JewishCalendar;
  formatter: HebrewDateFormatter;
}

export const DayText = (props: DayTextProps) => {
  const { selectedDay, isHebrew } = useZmanim();
  const { date, jewishCalendar, formatter } = props;
  const isSelectedDay = date.hasSame(selectedDay, 'day');

  const hebrewDate = `${jewishCalendar.getJewishDayOfMonth()} ${formatter.formatMonth(jewishCalendar)}`;
  const hebrewDay = jewishCalendar.getJewishDayOfMonth();
  const gregDate = date.toLocaleString({ day: 'numeric', month: 'short' });
  const gregDay = date.day;

  return (
    <Box display="flex" justifyContent="space-between" alignItems="center">
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        borderRadius={1}
        bgcolor={isSelectedDay ? '#474A61' : 'white'}
        width="34px"
        height="34px"
      >
        <Text fontSize="20px" fontWeight={500} color={isSelectedDay ? '#FFF' : '2C2D35'}>
          {isHebrew ? hebrewDay : gregDay}
        </Text>
      </Box>
      <Box>
        <Text fontSize="12px" fontWeight={400} color="#72758A">
          {isHebrew ? gregDate : hebrewDate}
        </Text>
      </Box>
    </Box>
  );
};
