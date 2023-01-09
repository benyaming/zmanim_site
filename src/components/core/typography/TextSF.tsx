import Typography, { TypographyProps } from '@mui/material/Typography';
import React from 'react';

export const TextSF = (props: TypographyProps) => {
  const { children, ...rest } = props;
  return (
    <Typography fontFamily="SF Pro" {...rest}>
      {children}
    </Typography>
  );
};
