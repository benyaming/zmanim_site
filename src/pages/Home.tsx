import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { Box, Button, Grid, Icon } from '@mui/material';
import React from 'react';

import { ZmanimCalendar, ZmanimInfo } from '../components';
import { useZmanim } from '../providers/ZmanimProvider';

export const Home = () => {
  const { setDate, date } = useZmanim();
  return (
    <Box py={2}>
      <Box>
        <Button
          onClick={() => setDate(date.minus({ month: 1 }))}
          sx={{ width: '38px', height: '38px', minWidth: 'unset' }}
        >
          <Icon>
            <KeyboardArrowLeftIcon />
          </Icon>
        </Button>
        <Button
          onClick={() => setDate(date.plus({ month: 1 }))}
          sx={{ width: '38px', height: '38px', minWidth: 'unset' }}
        >
          <Icon>
            <KeyboardArrowRightIcon />
          </Icon>
        </Button>
      </Box>
      <Grid container spacing={4}>
        <Grid item xs={8}>
          <Box py={2}>
            <ZmanimCalendar />
          </Box>
        </Grid>
        <Grid item xs={4}>
          <Box pt={8}>
            <ZmanimInfo />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};
