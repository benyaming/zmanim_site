import { Box } from '@mui/material';
import React from 'react';

import { TextSF } from '../../core/typography';

export interface ZmanimCalendarDayProps {
  date?: Date;
  firstDayOfMonth?: Date;
}

export interface DayTagProps {
  color: string;
  text: string;
}

export const ZmanimCalendarDay = (props: ZmanimCalendarDayProps) => {
  return (
    <Box>
      <TextSF>ZmanimCalendarDay</TextSF>
    </Box>
  );
};
