import { ArrowLeftIcon, ArrowRightIcon } from '@chakra-ui/icons';
import { Box, Button, ButtonGroup, Flex, FormControl, FormLabel, IconButton, Input } from '@chakra-ui/react';
import { addDays, format, getYear, setDay, setMonth, setYear } from 'date-fns';
import { JewishDate } from 'kosher-zmanim';
import { capitalize } from 'lodash';
import { Info } from 'luxon';
import React, { FocusEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { CalendarModeTypes, useCalendar } from '../../../providers/CalendarProvide';
import { timeLocales } from '../../../services/locales';
import { Formatter } from '../../../services/zmanim/formatter';
import { LanguageVariant } from '../../../types/i18n';
import { DateSelectControls } from './DateSelectControls';
import { ZmanimCalendarDay } from './ZmanimCalendarDay';

export const ZmanimCalendar = () => {
  const {
    toggleCalendar,
    handleSetDate,
    visibleDays,
    calendarMode,
    date,
    onNext,
    onPrev,
    handleDayClick,
    firstDayOfMonth,
    firstDayOfGrid,
  } = useCalendar();
  const jewishDate = new JewishDate(date);
  const { i18n } = useTranslation();
  const currentLang = i18n.language as LanguageVariant;

  const handleDateSelectClick = (value: number, type: 'year' | 'month' | 'day') => {
    switch (type) {
      case 'year':
        return handleSetDate(setYear(date, value));
      case 'month':
        return handleSetDate(setMonth(date, value));
      case 'day':
        return handleDayClick(setDay(date, value));
    }
  };

  const weekdays = [...Array(7).keys()].map((i) => i);
  return (
    <Box w={`${150 * 7}px`}>
      <ButtonGroup size="sm" isAttached variant="outline">
        <Button mr="-px" onClick={toggleCalendar} disabled={calendarMode === CalendarModeTypes.HEBREW}>
          Hebrew
        </Button>
        <Button mr="-px" onClick={toggleCalendar} disabled={calendarMode === CalendarModeTypes.GREGORIAN}>
          Grigorean
        </Button>
      </ButtonGroup>
      <Flex py={2} w="100%" justifyContent="space-between" alignItems="center">
        <IconButton aria-label="prev" icon={<ArrowLeftIcon />} onClick={onPrev} />
        <Flex w="350px" justifyContent="space-between">
          <Box>{`${format(date, 'MMMM', { locale: timeLocales[currentLang] })} ${getYear(date)}`}</Box>
          <Box>{capitalize(calendarMode)}</Box>
          <Box>{`${jewishDate.getJewishYear()} ${Formatter.formatMonth(jewishDate)}`}</Box>
        </Flex>
        <IconButton aria-label="prev" icon={<ArrowRightIcon />} onClick={onNext} />
      </Flex>
      <DateSelectControls handleChange={handleDateSelectClick} />

      <Flex py={2} bg="green.300" borderBottomColor="gray.800" borderBottomWidth={1} borderBottomStyle="solid">
        {weekdays.map((wd, idx) => (
          <Flex justifyContent="center" key={idx} width="150px" h="20px">
            {Info.weekdays('short', { locale: i18n.language })[idx ? idx - 1 : 6]}
          </Flex>
        ))}
      </Flex>

      <Flex flexWrap="wrap" py={2}>
        {new Array(visibleDays).fill(0).map((d, i) => (
          <ZmanimCalendarDay key={i} firstDayOfMonth={firstDayOfMonth} date={addDays(firstDayOfGrid, i)} />
        ))}
      </Flex>
    </Box>
  );
};
