import { Flex } from '@chakra-ui/react';
import React from 'react';

import { ZmanimCalendar } from '../components';
import { ZmanimInfo } from '../components/domain/zmanim/ZmanimInfo';
import { CalendarProvider } from '../providers/CalendarProvide';

export const Home = () => {
  return (
    <Flex justifyContent="center" flexDirection="column">
      <CalendarProvider>
        <ZmanimCalendar />
        <ZmanimInfo />
      </CalendarProvider>
    </Flex>
  );
};
