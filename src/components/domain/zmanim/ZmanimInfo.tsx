import { Box, Divider, Paper, Stack } from '@mui/material';
import { DateTime } from 'luxon';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useZmanimJson } from '../../../hooks/zmanim/useZmanimJson';
import { useZmanim } from '../../../providers/ZmanimProvider';
import { Text } from '../../core/typography';

export const ZmanimInfo = () => {
  const { lat, lng, selectedDay } = useZmanim();
  const { data: zmanimJson } = useZmanimJson({ lat, lng, date: selectedDay });
  const { t } = useTranslation();

  const info = {
    AlosHashachar: zmanimJson?.BasicZmanim?.AlosHashachar,
    Alos72: zmanimJson?.BasicZmanim?.Alos72,
    SofZmanShmaGRA: zmanimJson?.BasicZmanim?.SofZmanShmaGRA,
    SofZmanTfilaGRA: zmanimJson?.BasicZmanim?.SofZmanTfilaGRA,
    Sunrise: zmanimJson?.BasicZmanim?.Sunrise,
    Tzais72: zmanimJson?.BasicZmanim?.Tzais72,
  };
  return (
    <Paper>
      <Box px={8} py={4}>
        <Box display="flex" width="100%" justifyContent="space-between" alignItems="center">
          <Box>
            <Text fontSize="20px" fontWeight="500">
              {t('zmanim.title')}
            </Text>
          </Box>
          <Box>
            <Text> {t('zmanim.title')}</Text>
          </Box>
        </Box>
        <Box py={4}>
          <Divider />
        </Box>

        <Stack direction="column" spacing={4}>
          <Box display="flex" justifyContent="space-between">
            <Text color="#72758A" fontSize="12px">
              {DateTime.fromISO(info.AlosHashachar!).toLocaleString(DateTime.TIME_SIMPLE)}
            </Text>
            <Text fontSize="14px">Алот а-шахар (заря)</Text>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Text color="#72758A" fontSize="12px">
              {DateTime.fromISO(info.Alos72!).toLocaleString(DateTime.TIME_SIMPLE)}
            </Text>
            <Text fontSize="14px">Мишеякир (время Талита и Тифлин)</Text>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Text color="#72758A" fontSize="12px">
              {DateTime.fromISO(info.Sunrise!).toLocaleString(DateTime.TIME_SIMPLE)}
            </Text>
            <Text fontSize="14px">Анец а-хама (восход)</Text>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Text color="#72758A" fontSize="12px">
              {DateTime.fromISO(info.SofZmanShmaGRA!).toLocaleString(DateTime.TIME_SIMPLE)}
            </Text>
            <Text fontSize="14px">Зман Шма (время Шма) [АГРО]</Text>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Text color="#72758A" fontSize="12px">
              {DateTime.fromISO(info.SofZmanTfilaGRA!).toLocaleString(DateTime.TIME_SIMPLE)}
            </Text>
            <Text fontSize="14px">Зман тфила (время молитвы) [АГРО]</Text>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Text color="#72758A" fontSize="12px">
              {DateTime.fromISO(info.AlosHashachar!).toLocaleString(DateTime.TIME_SIMPLE)}
            </Text>
            <Text fontSize="14px">Хацот</Text>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Text color="#72758A" fontSize="12px">
              {DateTime.fromISO(info.AlosHashachar!).toLocaleString(DateTime.TIME_SIMPLE)}
            </Text>
            <Text fontSize="14px">Минха гдола</Text>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Text color="#72758A" fontSize="12px">
              {DateTime.fromISO(info.AlosHashachar!).toLocaleString(DateTime.TIME_SIMPLE)}
            </Text>
            <Text fontSize="14px">Минха гдола</Text>
          </Box>
          <Box display="flex" justifyContent="space-between">
            <Text color="#72758A" fontSize="12px">
              {DateTime.fromISO(info.Tzais72!).toLocaleString(DateTime.TIME_SIMPLE)}
            </Text>
            <Text fontSize="14px">Выход звезд [8.5 градусов за горизонтом]</Text>
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
};
