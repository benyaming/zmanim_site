import 'react-calendar/dist/Calendar.css';
import './calendar.scss';

import styled from '@emotion/styled';
import React, { useState } from 'react';
import Calendar from 'react-calendar';

import { ZmanimCalendarDay } from './ZmanimCalendarDay';

const StyledCalendar = styled(Calendar)`
  width: 100%;
  .react-calendar__tile {
    height: 80px;
  }
`;

export const ZmanimCalendar = () => {
  const [value, onChange] = useState(new Date());

  return (
    <div>
      <StyledCalendar tileContent={ZmanimCalendarDay} locale="en" onChange={onChange} value={value} />
    </div>
  );
};
