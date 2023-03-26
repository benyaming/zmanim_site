import { JewishDate } from 'kosher-zmanim';
import { DateTime } from 'luxon';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { timeLocales } from '../services/locales';
import { useGeolocation } from './GeoProvider';

export enum CalendarModeTypes {
  HEBREW = 'hebrew',
  GREGORIAN = 'gregorian',
}

export type CalendarMode = CalendarModeTypes.GREGORIAN | CalendarModeTypes.HEBREW;

export interface ZmanimProviderContextProps {
  setDate: (date: DateTime) => void;
  isHebrew: boolean;
  selectedDay: DateTime;
  lat: number;
  lng: number;
  toggleCalendarMode: (mode: CalendarMode) => void;
  setSelectedDay: (date: DateTime) => void;
  date: DateTime;
}

const ZmanimContext = createContext<ZmanimProviderContextProps>({
  date: DateTime.now(),
  setDate: () => {},
  isHebrew: false,
  selectedDay: DateTime.now(),
  setSelectedDay: () => {},
  toggleCalendarMode: () => {},
  lat: 0,
  lng: 0,
});

export const useZmanim = (): ZmanimProviderContextProps => useContext(ZmanimContext);

const ZmanimProvider = (props: { children: ReactNode }) => {
  const { children } = props;
  const [date, setDate] = useState(DateTime.now().set({ day: 15 }));
  const [startDate, setStartDate] = useState(DateTime.now().set({ day: 1 }));
  const [endDate, setEndDate] = useState(DateTime.now().set({ day: 30 }));
  const [calendarMode, toggleCalendarMode] = useState<CalendarMode>(CalendarModeTypes.GREGORIAN);
  const [selectedDay, setSelectedDay] = useState(DateTime.now());
  const {
    latLng: { lat, lng },
  } = useGeolocation();

  const isHebrew = calendarMode === CalendarModeTypes.HEBREW;

  const jewishDate = new JewishDate(date);
  const handleModeChange = () => {
    if (!isHebrew) {
      jewishDate.setJewishDayOfMonth(1);
      setDate(jewishDate.getDate());
    } else {
      setDate(date.set({ day: 15 }));
    }
    toggleCalendarMode(isHebrew ? CalendarModeTypes.GREGORIAN : CalendarModeTypes.HEBREW);
  };

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
        toggleCalendarMode: handleModeChange,
      }}
    >
      {children}
    </ZmanimContext.Provider>
  );
};

export { ZmanimContext, ZmanimProvider };
