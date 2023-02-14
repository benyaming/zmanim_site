import './styles/index.css';

import { Box, ThemeProvider } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';

import { ZmanimProvider } from './providers/ZmanimProvider';
import { AppRouter } from './routes/AppRouter';
import { theme } from './theme';

function App() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
  return (
    <Box
      height="100vh"
      id="app-component"
      display="flex"
      sx={{
        minWidth: '900px',
      }}
    >
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <ZmanimProvider>
              <AppRouter />
              <ReactQueryDevtools initialIsOpen={false} />
            </ZmanimProvider>
          </QueryClientProvider>
        </BrowserRouter>
      </ThemeProvider>
    </Box>
  );
}

export default App;
