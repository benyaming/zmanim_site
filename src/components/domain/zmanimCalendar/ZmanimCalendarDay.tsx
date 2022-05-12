import { Box, Flex, SystemStyleObject, useToken } from '@chakra-ui/react';
import { format, isSameDay, isSameMonth, isToday } from 'date-fns';
import { JewishDate } from 'kosher-zmanim';
import React from 'react';

import { CalendarModeTypes, useCalendar } from '../../../providers/CalendarProvide';
import { Formatter } from '../../../services/zmanim/formatter';

export interface ZmanimCalendarDayProps {
  date: Date;
  firstDayOfMonth: Date;
}

export const ZmanimCalendarDay = (props: ZmanimCalendarDayProps) => {
  const { date, firstDayOfMonth } = props;
  const { selectedDay, handleDayClick, calendarMode } = useCalendar();
  const [currentMonth, outerMonth, today, selectedBorder] = useToken('colors', [
    'white',
    'gray.200',
    'orange.100',
    'teal.200',
  ]);
  const jewDate = new JewishDate(date);

  const isItToday = isToday(date);
  const isDaySelected = isSameDay(selectedDay, date);
  const isCurrentMonth = () => {
    if (calendarMode === CalendarModeTypes.HEBREW) {
      return new JewishDate(firstDayOfMonth).getJewishMonth() === jewDate.getJewishMonth();
    }
    return isSameMonth(date, firstDayOfMonth);
  };

  const daySx: SystemStyleObject = {
    cursor: 'pointer',
    bg: () => {
      if (isItToday) return today;
      if (isCurrentMonth()) return currentMonth;
      return outerMonth;
    },
  };

  const innerBlockSx: SystemStyleObject = {
    border: isDaySelected ? `4px solid ${selectedBorder}` : '1px solid gray',
    justifyContent: 'space-between',
    w: '150px',
    h: '75px',
    px: 2,
  };

  const handleClick = () => {
    console.log(date);
    handleDayClick(date);
  };

  return (
    <Flex cursor="pointer" sx={daySx} onClick={handleClick}>
      <Flex sx={innerBlockSx}>
        <Box>{format(date, 'dd MMM')}</Box>
        <Box>{`${jewDate.getJewishDayOfMonth()} ${Formatter.formatMonth(jewDate)}`}</Box>
      </Flex>
    </Flex>
  );
};
