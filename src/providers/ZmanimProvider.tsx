import { DateTime } from 'luxon';
import React, { createContext, ReactNode, useContext, useState } from 'react';

import { useGeolocation } from './GeoProvider';

export enum CalendarModeTypes {
  HEBREW = 'hebrew',
  GREGORIAN = 'gregorian',
}

export type CalendarMode = CalendarModeTypes.GREGORIAN | CalendarModeTypes.HEBREW;

export interface ZmanimProviderContextProps {
  setDate: (date: DateTime) => void;
  calendarMode: CalendarMode;
  isHebrew: boolean;
  selectedDay: DateTime;
  lat: number;
  lng: number;
  setSelectedDay: (date: DateTime) => void;
  date: DateTime;
}

const ZmanimContext = createContext<ZmanimProviderContextProps>({
  date: DateTime.now(),
  setDate: () => {},
  calendarMode: CalendarModeTypes.GREGORIAN,
  isHebrew: false,
  selectedDay: DateTime.now(),
  setSelectedDay: () => {},
  lat: 0,
  lng: 0,
});

export const useZmanim = (): ZmanimProviderContextProps => useContext(ZmanimContext);

const ZmanimProvider = (props: { children: ReactNode }) => {
  const { children } = props;
  const [date, setDate] = useState(DateTime.now());
  const [calendarMode, toggleCalendarMode] = useState<CalendarMode>(CalendarModeTypes.GREGORIAN);
  const [selectedDay, setSelectedDay] = useState(date);

  const {
    latLng: { lat, lng },
  } = useGeolocation();

  const isHebrew = calendarMode === CalendarModeTypes.HEBREW;

  return (
    <ZmanimContext.Provider
      value={{
        setDate,
        date,
        lat,
        lng,
        selectedDay,
        setSelectedDay,
        isHebrew,
        calendarMode,
      }}
    >
      {children}
    </ZmanimContext.Provider>
  );
};

export { ZmanimContext, ZmanimProvider };
