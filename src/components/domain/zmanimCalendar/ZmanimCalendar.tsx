import { Box } from '@mui/material';
import React from 'react';

import { ZmanimCalendarDay } from './ZmanimCalendarDay';

export const ZmanimCalendar = () => {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gridTemplateRow: 'repeat(5, 1fr)',
      }}
    >
      <ZmanimCalendarDay />
    </Box>
  );
};
