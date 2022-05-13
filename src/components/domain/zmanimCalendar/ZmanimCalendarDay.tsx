import { Box, Flex, SystemStyleObject, useToken } from '@chakra-ui/react';
import { format, isSameDay, isSameMonth, isToday } from 'date-fns';
import { enUS, he, ru } from 'date-fns/locale';
import { JewishCalendar, JewishDate } from 'kosher-zmanim';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { CalendarModeTypes, useCalendar } from '../../../providers/CalendarProvide';
import { Formatter } from '../../../services/zmanim/formatter';

export interface ZmanimCalendarDayProps {
  date: Date;
  firstDayOfMonth: Date;
}

const locales = {
  en: enUS,
  ru,
  he,
};

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
    handleDayClick(date);
  };

  return (
    <Flex sx={daySx} onClick={handleClick}>
      <Flex sx={innerBlockSx} flexWrap="wrap">
        <Box>{format(date, 'dd MMM', { locale: locales[i18n.language as 'en' | 'he' | 'ru'] })}</Box>
        <Box>{`${jewDate.getJewishDayOfMonth()} ${Formatter.formatMonth(jewDate)}`}</Box>
      </Flex>
    </Flex>
  );
};
