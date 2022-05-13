import { ArrowLeftIcon, ArrowRightIcon } from '@chakra-ui/icons';
import { Box, Button, ButtonGroup, Flex, IconButton } from '@chakra-ui/react';
import { addDays, format, getYear } from 'date-fns';
import { JewishDate } from 'kosher-zmanim';
import { capitalize } from 'lodash';
import { Info } from 'luxon';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { CalendarModeTypes, useCalendar } from '../../../providers/CalendarProvide';
import { Formatter } from '../../../services/zmanim/formatter';
import { ZmanimCalendarDay } from './ZmanimCalendarDay';

export const ZmanimCalendar = () => {
  const { toggleCalendar, visibleDays, calendarMode, date, onNext, onPrev, firstDayOfMonth, firstDayOfGrid } =
    useCalendar();
  const jewishDate = new JewishDate(date);
  const { i18n } = useTranslation();

  console.log('visibleDays', visibleDays);

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
          <Box>{`${format(date, 'MMMM')} ${getYear(date)}`}</Box>
          <Box>{capitalize(calendarMode)}</Box>
          <Box>{`${jewishDate.getJewishYear()} ${Formatter.formatMonth(jewishDate)}`}</Box>
        </Flex>
        <IconButton aria-label="prev" icon={<ArrowRightIcon />} onClick={onNext} />
      </Flex>

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
