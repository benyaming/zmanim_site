import styled from '@emotion/styled';
import { Box } from '@mui/material';
import { HebrewDateFormatter, JewishCalendar } from 'kosher-zmanim';
import { DateTime } from 'luxon';
import React from 'react';

import { useZmanim } from '../../../providers/ZmanimProvider';
import { isShabat } from '../../../utils';
import { Text } from '../../core/typography';
import { DayLabel } from './DayLabel';
import { DayText } from './DayText';
import { Parsha } from './Parsha';
import { RoshHodesh } from './RoshHodesh';

export interface ZmanimCalendarDayProps {
  date: DateTime;
  onClick: (date: DateTime) => void;
  isOffRange?: boolean;
}

export const ZmanimCalendarDay = (props: ZmanimCalendarDayProps) => {
  const { date, onClick, isOffRange } = props;
  const { date: globalDate, isHebrew } = useZmanim();

  const jewishCalendar = new JewishCalendar(date);
  const hebrewDateFormatter = new HebrewDateFormatter();

  const parsha = hebrewDateFormatter.formatParsha(jewishCalendar);

  const getBackground = () => {
    switch (true) {
      case isOffRange:
        return '#F4F4F6';
      case isShabat(date):
        return '#F2F8FE';
      default:
        return '#FFF';
    }
  };
  return (
    <Box onClick={() => onClick(date)} p={2} width="100%" height="100%" minHeight="140px" bgcolor={getBackground()}>
      <DayText date={date} jewishCalendar={jewishCalendar} formatter={hebrewDateFormatter} />
      <DayLabel isOffRange={isOffRange} jewishCalendar={jewishCalendar} formatter={hebrewDateFormatter} date={date} />
      <RoshHodesh jewishCalendar={jewishCalendar} formatter={hebrewDateFormatter} date={date} />
      {parsha && <Parsha parsha={parsha} />}
    </Box>
  );
};
