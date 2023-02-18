import { Box, useTheme } from '@mui/material';
import { HebrewDateFormatter, JewishCalendar } from 'kosher-zmanim';
import { DateTime } from 'luxon';
import React from 'react';

import { Text } from '../../core/typography';

export interface RoshHodeshProps {
  jewishCalendar: JewishCalendar;
  formatter: HebrewDateFormatter;
  date: DateTime;
}

export const RoshHodesh = (props: RoshHodeshProps) => {
  const { jewishCalendar } = props;
  const { palette } = useTheme();
  const rosh = jewishCalendar.isRoshChodesh();

  if (!rosh) return null;

  return (
    <Box sx={{ background: palette.roshHodesh.main }} px={1} borderRadius="2px">
      <Text fontSize="12px" color={palette.text.primary}>
        Rosh Hodesh
      </Text>
    </Box>
  );
};
