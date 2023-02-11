import { Box } from '@mui/material';
import { DateTime } from 'luxon';
import React from 'react';

import { useZmanim } from '../../../providers/ZmanimProvider';
import { isShabat } from '../../../utils';
import { Text } from '../../core/typography';

export interface ZmanimCalendarDayProps {
  date: DateTime;
  onClick: (date: DateTime) => void;
}

export interface DayTagProps {
  color: string;
  text: string;
}

export const ZmanimCalendarDay = (props: ZmanimCalendarDayProps) => {
  const { date, onClick } = props;
  const { date: globalDate, selectedDay } = useZmanim();
  const today = DateTime.now().hasSame(date, 'day');
  const sameMonth = DateTime.now().hasSame(date, 'month');
  const isSelectedDay = date.hasSame(selectedDay, 'day');

  const getBackground = () => {
    switch (true) {
      case !sameMonth:
        return '#F4F4F6';
      case isShabat(date):
        return '#F2F8FE';
      default:
        return '#FFF';
    }
  };
  return (
    <Box
      onClick={() => onClick(date)}
      p={2}
      width="100%"
      height="100%"
      minHeight="140px"
      borderBottom="1px solid #DCDCE2"
      borderRight="1px solid #DCDCE2"
      bgcolor={getBackground()}
    >
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
          <Text fontSize="18px" color={isSelectedDay ? '#FFF' : '2C2D35'}>
            {date.day}
          </Text>
        </Box>
        <Box>
          <Text fontSize="12px" fontWeight={400}>
            {date.toLocaleString({ day: 'numeric', month: 'short' })}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
