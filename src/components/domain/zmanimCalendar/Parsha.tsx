import { Box, Stack } from '@mui/material';
import React from 'react';

import bookIcon from '../../../assets/book.svg';
import { Text } from '../../core/typography';

export interface ParshaProps {
  parsha: string;
}
export const Parsha = (props: ParshaProps) => {
  const { parsha } = props;
  return (
    <Box display="flex" alignItems="center" mt={1} color="#2C2D35" px={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <img alt="book" src={bookIcon} width="16px" height="16px" />
        <Text fontSize="12px" fontWeight={400}>
          {parsha}
        </Text>
      </Stack>
    </Box>
  );
};
