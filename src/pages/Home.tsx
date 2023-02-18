import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { Box, Button, Grid, Icon, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { JewishDate } from 'kosher-zmanim';
import React from 'react';

import { ZmanimCalendar, ZmanimInfo } from '../components';
import { Text } from '../components/core/typography';
import { CalendarModeTypes, useZmanim } from '../providers/ZmanimProvider';

export const Home = () => {
  const { setDate, date, isHebrew, toggleCalendarMode } = useZmanim();

  const jewishDate = new JewishDate(date);
  const handleModeChange = () => {
    if (!isHebrew) {
      jewishDate.setJewishDayOfMonth(1);
      setDate(jewishDate.getDate());
    } else {
      setDate(date.set({ day: 1 }));
    }
    toggleCalendarMode(isHebrew ? CalendarModeTypes.GREGORIAN : CalendarModeTypes.HEBREW);
  };

  const handlePrev = () => {
    if (isHebrew) {
      jewishDate.back();
      jewishDate.setJewishDayOfMonth(1);
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
          <Text>{date.toLocaleString({ month: 'long', year: 'numeric', day: 'numeric' })}</Text>
        </Box>
        <Box>
          <Stack direction="row" spacing={8} alignItems="center">
            <ToggleButtonGroup value={isHebrew ? 'hebrew' : 'greg'} exclusive onChange={handleModeChange}>
              <ToggleButton disabled={!isHebrew} size="small" value="greg">
                Gregorian
              </ToggleButton>
              <ToggleButton disabled={isHebrew} size="small" value="">
                Hebrew
              </ToggleButton>
            </ToggleButtonGroup>
            <Button onClick={handlePrev} sx={{ width: '38px', height: '38px', minWidth: 'unset' }}>
              <Icon>
                <KeyboardArrowLeftIcon />
              </Icon>
            </Button>
            <Button onClick={handleNext} sx={{ width: '38px', height: '38px', minWidth: 'unset' }}>
              <Icon>
                <KeyboardArrowRightIcon />
              </Icon>
            </Button>
          </Stack>
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
