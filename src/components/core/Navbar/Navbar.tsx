import { AppBar, Container, Toolbar } from '@mui/material';
import React from 'react';

import logo from '../../../assets/zmanin-logo.svg';

export const Navbar = () => {
  return (
    <AppBar
      position="static"
      elevation={4}
      sx={{
        background: 'white',
        borderRadius: 0,
        // boxShadow: '0px 1px 8px rgba(114, 117, 138, 0.15);'
      }}
    >
      <Container maxWidth="xl">
        <Toolbar>
          <img alt="logo" src={logo} width="32px" height="28px" />
        </Toolbar>
      </Container>
    </AppBar>
  );
};
