import { Box } from '@chakra-ui/react';
import React from 'react';

import { AppRouter } from './routes/AppRouter';

function App() {
  return (
    <Box minHeight="100vh">
      <AppRouter />
    </Box>
  );
}

export default App;
