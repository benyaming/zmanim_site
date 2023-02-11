import Typography, { TypographyProps } from '@mui/material/Typography';
import React from 'react';

export const Text = (props: TypographyProps) => {
  const { children, ...rest } = props;
  return (
    <Typography fontFamily="Arimo" {...rest}>
      {children}
    </Typography>
  );
};
