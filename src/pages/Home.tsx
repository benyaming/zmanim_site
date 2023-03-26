import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { Box, Button, capitalize, Grid, Icon, Stack } from '@mui/material';
import { JewishDate } from 'kosher-zmanim';
import { DateTime } from 'luxon';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { SwitchMode, ZmanimCalendar, ZmanimInfo } from '../components';
import { Text } from '../components';
import { useZmanim } from '../providers/ZmanimProvider';

export const Home = () => {
  const { setDate, date, isHebrew } = useZmanim();
  const { t } = useTranslation();
  const jewishDate = new JewishDate(date);

  const handlePrev = () => {
    if (isHebrew) {
      jewishDate.setJewishDayOfMonth(1);
      jewishDate.back();
      jewishDate.setJewishDayOfMonth(15);
      setDate(date.set(jewishDate.getDate().toObject()));
    }
    return setDate(date.minus({ month: 1 }));
  };

  const handleNext = () => {
    if (isHebrew) {
      setDate(date.plus({ day: jewishDate.getDaysInJewishMonth() - 1 }));
    }
    return setDate(date.plus({ month: 1 }));
  };
  return (
    <Box py={2} px={8}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box py={2}>
          <Text fontSize="32px" fontWeight={700}>
            {capitalize(date.toLocaleString({ month: 'long', year: 'numeric' }))}
          </Text>
        </Box>
        <Box display="flex">
          <Stack direction="row" spacing={2} alignItems="center">
            <Button onClick={handlePrev} sx={{ width: '38px', height: '38px', minWidth: 'unset' }}>
              <Icon>
                <KeyboardArrowLeftIcon />
              </Icon>
            </Button>
            <Button onClick={() => setDate(DateTime.now())} sx={{ height: '38px', minWidth: 'unset' }}>
              {t('days.today')}
            </Button>
            <Button onClick={handleNext} sx={{ width: '38px', height: '38px', minWidth: 'unset' }}>
              <Icon>
                <KeyboardArrowRightIcon />
              </Icon>
            </Button>
          </Stack>
          <Box ml={8}>
            <SwitchMode />
          </Box>
        </Box>
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
