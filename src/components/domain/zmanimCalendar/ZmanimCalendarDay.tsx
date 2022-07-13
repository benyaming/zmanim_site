import { Box, Flex, SystemStyleObject, useToken } from '@chakra-ui/react';
import { format, isSameDay, isSameMonth, isToday } from 'date-fns';
import { JewishCalendar, JewishDate } from 'kosher-zmanim';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { CalendarModeTypes, useCalendar } from '../../../providers/CalendarProvide';
import { timeLocales } from '../../../services/locales';
import { Formatter } from '../../../services/zmanim/formatter';
import { LanguageVariant } from '../../../types/i18n';

export interface ZmanimCalendarDayProps {
  date: Date;
  firstDayOfMonth: Date;
}

export const ZmanimCalendarDay = (props: ZmanimCalendarDayProps) => {
  const { date, firstDayOfMonth } = props;
  const { selectedDay, handleDayClick, calendarMode } = useCalendar();
  const { i18n } = useTranslation();
  const [currentMonth, outerMonth, today, selectedBorder] = useToken('colors', [
    'white',
    'gray.200',
    'orange.100',
    'teal.200',
  ]);
  const jewDate = new JewishDate(date);
  const jewCalendar = new JewishCalendar(date);
  const currentLang = i18n.language as LanguageVariant;

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
    border: `1px solid ${isDaySelected ? selectedBorder : 'gray'}`,
    justifyContent: 'space-between',
    w: '150px',
    h: '75px',
    px: 2,
  };

  const handleClick = () => {
    handleDayClick(date);
  };

  return (
    <Flex sx={daySx} onClick={handleClick}>
      <Flex sx={innerBlockSx} flexWrap="wrap">
        <Box>{format(date, 'dd MMM', { locale: timeLocales[currentLang] })}</Box>
        <Box>{`${jewDate.getJewishDayOfMonth()} ${Formatter.formatMonth(jewDate)}`}</Box>
      </Flex>
    </Flex>
  );
};
