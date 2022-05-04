import { Box, Flex } from '@chakra-ui/react';
import { getTime } from 'date-fns';
import React, { useState } from 'react';

import { ZmanimCalendar } from '../components/domain/calendar/ZmanimCalendar';
import { ZmanimInfo } from '../components/domain/zmanim/ZmanimInfo';

export const Home = () => {
  const [timestamp, setTimestamp] = useState(0);
  const handleDayClick = (v: Date) => {
    setTimestamp(getTime(v));
  };
  return (
    <Flex gap={4}>
      <Box w="80%">
        <ZmanimCalendar handleDayClick={handleDayClick} />
      </Box>
      <Box>
        <ZmanimInfo timestamp={timestamp} />
      </Box>
    </Flex>
  );
};
