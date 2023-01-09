import Typography, { TypographyProps } from '@mui/material/Typography';
import React from 'react';

export const TextPilat = (props: TypographyProps) => {
  const { children, ...rest } = props;
  return (
    <Typography fontFamily="Pilat Extended" {...rest}>
      {children}
    </Typography>
  );
};
