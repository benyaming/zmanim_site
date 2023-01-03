import { Box, Container } from '@mui/material';
import React from 'react';
import { Outlet } from 'react-router-dom';

import { Footer, Navbar } from '../components';

export const AppLayout = () => {
  return (
    <Box minHeight="100vh" id="layout" display="flex" flexDirection="column">
      <Navbar />
      <Box component="main" display="flex" flexGrow={1} pt={1}>
        <Container maxWidth="xl">
          <Outlet />
        </Container>
      </Box>

      <Footer />
    </Box>
  );
};
