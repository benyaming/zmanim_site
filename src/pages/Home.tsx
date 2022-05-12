import { Flex } from '@chakra-ui/react';
import React from 'react';

import { ZmanimCalendar } from '../components';
import { CalendarProvider } from '../providers/CalendarProvide';

export const Home = () => {
  return (
    <Flex justifyContent="center">
      <CalendarProvider>
        <ZmanimCalendar />
      </CalendarProvider>
    </Flex>
  );
};
