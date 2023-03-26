import { Box, Container } from '@mui/material';
import React from 'react';
import { Outlet } from 'react-router-dom';

import { Footer, Navbar } from '../components';

export const AppLayout = () => {
  return (
    <Box
      minHeight="100vh"
      width="100%"
      minWidth="1024px"
      overflow="scroll"
      id="layout"
      display="flex"
      flexDirection="column"
    >
      <Navbar />
      <Box component="main" display="flex" flexGrow={1} pt={1} sx={{ background: '#FAFAFA' }}>
        <Container maxWidth="xl">
          <Outlet />
        </Container>
      </Box>
      <Footer />
    </Box>
  );
};
