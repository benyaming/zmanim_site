import { Box, Container } from '@mui/material';
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from '../components/core/Header/Header';
import { Footer, Navbar } from '../components';

export const AppLayout = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',

        width: 1,
        height: '100vh',
        backgroundColor: '#D9D9D9',
      }}
    >
      <Header />
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
