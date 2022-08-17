import { Box, Flex, SystemStyleObject, Tag, TagLabel, Text, useToken } from '@chakra-ui/react';
import { format, isSameDay, isSameMonth, isToday } from 'date-fns';
import { JewishCalendar, JewishDate } from 'kosher-zmanim';
import { DateTime } from 'luxon';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { CalendarModeTypes, useCalendar } from '../../../providers/CalendarProvide';
import { timeLocales } from '../../../services/locales';
import { Formatter } from '../../../services/zmanim/formatter';
import { LanguageVariant } from '../../../types/i18n';
import { getSignificantDay } from '../../../utils/calendar';

export interface ZmanimCalendarDayProps {
  date: Date;
  firstDayOfMonth: Date;
}

export interface DayTagProps {
  color: string;
  text: string;
}

export const DayTag = ({ color, text }: DayTagProps) => {
  const { t } = useTranslation();
  return (
    <Box p={1} bg={color} borderRadius="3xl">
      <Text fontSize="xx-small" color="white">
        {t(text)}
      </Text>
    </Box>
  );
};

export const ZmanimCalendarDay = (props: ZmanimCalendarDayProps) => {
  const { date, firstDayOfMonth } = props;
  const { selectedDay, handleDayClick, calendarMode } = useCalendar();
  const { i18n } = useTranslation();
  const [currentMonth, outerMonth, today] = useToken('colors', ['white', 'gray.200', 'orange.100', 'teal.200']);
  const jewDate = new JewishDate(date);
  const dateTime = DateTime.fromJSDate(date);
  const currentLang = i18n.language as LanguageVariant;

  const isItToday = isToday(date);
  const isDaySelected = isSameDay(selectedDay, date);
  const [shabbat, yom, hol, abst, rosh, holiday]: string[] = useToken('colors', [
    'blue.400',
    'green.500',
    'green.200',
    'red.300',
    'teal.500',
    'yellow.400',
  ]);
  const jewCalendar = new JewishCalendar(dateTime);
  jewCalendar.setInIsrael(true);

  // check if there is indexed yom tov here
  const yomTov = getSignificantDay(jewCalendar.getYomTovIndex());

  // check if it is shabbat
  const isShabbat = jewDate.getDayOfWeek() === 7 ? { color: shabbat, text: 'shabbat' } : null;

  // check if it is yom tom with work prohibit
  const isYomTov = jewCalendar.isAssurBemelacha() && !isShabbat && !yomTov ? { color: yom, text: 'yom' } : null;
  const isChanukah = jewCalendar.isChanukah() ? { color: yom, text: 'chanukah' } : null;
  const isHol = jewCalendar.isCholHamoed() ? { color: hol, text: 'hol' } : null;

  // if it is indexed Yom Tov - get it and its name
  const isHoliday = yomTov ? { color: holiday, text: yomTov.name } : null;

  const isRosh = jewCalendar.isRoshChodesh() ? { color: rosh, text: 'rosh' } : null;

  // put all possible tags to array, to filter only non-falsy values in view
  const tags = [isYomTov, isHol, isRosh, isChanukah, isHoliday];

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
    border: '1px solid gray',
    outline: () => isDaySelected && `3px solid #81E6D9`,
    outlineOffset: '-3px',
    alignItems: 'flex-start',
    w: '150px',
    h: '75px',
    px: 2,
  };

  const handleClick = () => {
    handleDayClick(date);
  };

  return (
    <Flex sx={daySx} onClick={handleClick} justifyContent="flex-start" alignItems="flex-start" flexDirection="column">
      <Flex sx={innerBlockSx} flexWrap="wrap" pb={2}>
        <Flex justifyContent="space-between" w="100%">
          <Box>
            <Text fontSize="sm">{format(date, 'dd MMM', { locale: timeLocales[currentLang] })}</Text>
          </Box>
          <Box>
            <Text fontSize="sm">{`${jewDate.getJewishDayOfMonth()} ${Formatter.formatMonth(jewDate)}`}</Text>
          </Box>
        </Flex>
        {tags
          .filter((t) => t)
          .map((t) => (
            <DayTag color={t!.color} key={t!.color} text={t!.text} />
          ))}
      </Flex>
    </Flex>
  );
};
