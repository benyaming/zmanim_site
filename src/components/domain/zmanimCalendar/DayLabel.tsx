import { Box, useTheme } from '@mui/material';
import { HebrewDateFormatter, JewishCalendar } from 'kosher-zmanim';
import { DateTime } from 'luxon';
import React from 'react';

import { Text } from '../../core/typography';

export interface DayLabelProps {
  jewishCalendar: JewishCalendar;
  formatter: HebrewDateFormatter;
  date: DateTime;
  isOffRange?: boolean;
}

export const DayLabel = (props: DayLabelProps) => {
  const { jewishCalendar, formatter, isOffRange } = props;
  const { palette } = useTheme();
  const yom = formatter.formatYomTov(jewishCalendar);

  const bgColor = () => {
    switch (true) {
      case isOffRange:
        return '#DCDCE2';
      case jewishCalendar.isChanukah():
        return palette.hanuka.main;
      case jewishCalendar.isErevYomTov():
        return palette.erevHag.main;
      case jewishCalendar.isCholHamoed():
        return palette.hol.main;
      case jewishCalendar.isYomTov():
        return palette.yom.main;
      case jewishCalendar.isTaanis():
        return palette.erevHag.main;
    }
  };
  if (!yom) return null;

  return (
    <Box sx={{ background: bgColor() }} px={1} borderRadius="2px">
      <Text fontSize="12px" color={palette.text.primary}>
        {yom}
      </Text>
    </Box>
  );
};
