import { Box } from '@mui/material';
import React from 'react';

import { ZmanimCalendar, ZmanimInfo } from '../components';

export const Home = () => {
  return (
    <Box justifyContent="center" display="flex" flexDirection="column">
      <ZmanimCalendar />
      <ZmanimInfo />
    </Box>
  );
};
