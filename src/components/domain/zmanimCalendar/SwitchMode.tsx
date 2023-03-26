import { Box, BoxProps } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { CalendarModeTypes, useZmanim } from '../../../providers/ZmanimProvider';
import { Text } from '../../core/typography';

export const SwitchBtn = (props: BoxProps) => {
  const { children, ...rest } = props;
  return (
    <Box width="125px" height="38px" display="flex" justifyContent="center" alignItems="center" {...rest}>
      {children}
    </Box>
  );
};

export const SwitchMode = () => {
  const { isHebrew, toggleCalendarMode } = useZmanim();
  const { t } = useTranslation();
  return (
    <Box
      sx={{ cursor: 'pointer' }}
      display="flex"
      borderRadius={1}
      border="2px solid #FFF"
      box-shadow=" .5px 1.5px 4px rgba(114, 117, 138, 0.15)"
    >
      <SwitchBtn
        bgcolor={isHebrew ? '#474A61' : '#F4F4F6'}
        borderRadius="4px 0 0 4px"
        onClick={() => toggleCalendarMode(CalendarModeTypes.HEBREW)}
      >
        <Text color={isHebrew ? '#FFF' : '#72758A'}>{t('mode.hebrew')}</Text>
      </SwitchBtn>
      <SwitchBtn
        bgcolor={isHebrew ? '#F4F4F6' : '#474A61'}
        borderRadius="0 4px 4px 0"
        onClick={() => toggleCalendarMode(CalendarModeTypes.GREGORIAN)}
      >
        <Text color={isHebrew ? '#72758A' : '#FFF'}>{t('mode.gregorian')}</Text>
      </SwitchBtn>
    </Box>
  );
};
