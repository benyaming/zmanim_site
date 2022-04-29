import { Box, Container } from '@chakra-ui/react';
import React from 'react';
import { Outlet } from 'react-router-dom';

import { Footer, Navbar } from '../components';

export const AppLayout = () => {
  return (
    <Box minH="100vh" id="layout" display="flex" flexDirection="column">
      <Navbar />
      <Box as="main">
        <Container maxW="container.lg" pt={1}>
          <Outlet />
        </Container>
      </Box>

      <Footer />
    </Box>
  );
};