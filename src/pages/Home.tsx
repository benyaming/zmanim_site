import { Box } from '@mui/material';
import React from 'react';
import { ZmanimCalendar, ZmanimInfo } from '../components';

export const Home = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: 1,
      }}
    >
      <Box
        sx={{
          width: '68vw',
          height: '57vh',
          backgroundColor: 'grey',
        }}
      >
        <ZmanimCalendar />
      </Box>
      <Box
        sx={{
          width: '100%',
          height: '45vh',
          backgroundColor: 'grey',
        }}
      >
        <ZmanimInfo />
      </Box>
    </Box>
  );
};
