import { addDays, addMonths, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { JewishDate, JsonOutput } from 'kosher-zmanim';
import React, { createContext, useContext, useEffect, useState } from 'react';

import { useZmanimJson } from '../hooks/zmanim/useZmanimJson';
import { useGeolocation } from './GeoProvider';

export enum CalendarModeTypes {
  HEBREW = 'hebrew',
  GREGORIAN = 'gregorian',
}

export type CalendarMode = CalendarModeTypes.GREGORIAN | CalendarModeTypes.HEBREW;

export interface CalendarProviderContextProps {
  toggleCalendar: () => void;
  onNext: () => void;
  onPrev: () => void;
  calendarMode: CalendarMode;
  isHebrew: boolean;
  selectedDay: Date | number;
  handleDayClick: (date: Date) => void;
  handleSetDate: (date: Date) => void;
  date: Date;
  firstDayOfGrid: Date;
  firstDayOfMonth: Date;
  zmanimJson: JsonOutput | undefined;
}

const CalendarContext = createContext<CalendarProviderContextProps>({
  toggleCalendar: () => {},
  handleDayClick: () => {},
  handleSetDate: () => {},
  onNext: () => {},
  onPrev: () => {},
  calendarMode: CalendarModeTypes.GREGORIAN,
  isHebrew: false,
  selectedDay: -1,
  date: new Date(),
  firstDayOfGrid: new Date(),
  firstDayOfMonth: new Date(),
  zmanimJson: undefined,
});

export const useCalendar = (): CalendarProviderContextProps => useContext(CalendarContext);

const CalendarProvider: React.FC = (props): JSX.Element => {
  const { children } = props;
  const [date, setDate] = useState(new Date());
  const [calendarMode, toggleCalendarMode] = useState<CalendarMode>(CalendarModeTypes.GREGORIAN);
  const [selectedDay, setSelectedDay] = useState<Date>(date);
  const [firstDayOfMonth, setFirstDayOfMonth] = useState(startOfMonth(date));
  const [firstDayOfGrid, setFirstDayOfGrid] = useState(startOfWeek(firstDayOfMonth));

  const timestamp = selectedDay.getTime();
  const {
    latLng: { lat, lng },
  } = useGeolocation();

  const { data: zmanimJson } = useZmanimJson({ lat, lng, timestamp });

  const jewishDate = new JewishDate(date);

  const isHebrew = calendarMode === CalendarModeTypes.HEBREW;

  const handleSetDate = (date: Date) => {
    setDate(date);
  };

  const handleDayClick = (day: Date) => {
    setSelectedDay(day);
  };
  const toggleCalendar = () => {
    if (calendarMode === CalendarModeTypes.GREGORIAN) {
      jewishDate.setJewishDayOfMonth(1);
      setFirstDayOfMonth(jewishDate.getDate().toJSDate());
      setFirstDayOfGrid(jewishDate.getDate().toJSDate());
    }
    if (calendarMode === CalendarModeTypes.HEBREW) {
      setFirstDayOfMonth(startOfMonth(date));
      setFirstDayOfGrid(startOfWeek(firstDayOfMonth));
    }
    toggleCalendarMode(
      calendarMode === CalendarModeTypes.GREGORIAN ? CalendarModeTypes.HEBREW : CalendarModeTypes.GREGORIAN,
    );
  };

  const onNext = () => {
    if (calendarMode === CalendarModeTypes.GREGORIAN) {
      handleSetDate(addMonths(firstDayOfMonth, 1));
    }
    if (calendarMode === CalendarModeTypes.HEBREW) {
      const daysInJewishMonth = jewishDate.getDaysInJewishMonth();
      handleSetDate(addDays(firstDayOfMonth, daysInJewishMonth));
    }
  };
  const onPrev = () => {
    if (calendarMode === CalendarModeTypes.GREGORIAN) {
      handleSetDate(subMonths(date, 1));
    }
    if (calendarMode === CalendarModeTypes.HEBREW) {
      jewishDate.setJewishDayOfMonth(1);
      jewishDate.back();
      handleSetDate(jewishDate.getDate().toJSDate());
    }
  };

  useEffect(() => {
    if (calendarMode === CalendarModeTypes.GREGORIAN) {
      setFirstDayOfMonth(startOfMonth(date));
    }
    if (calendarMode === CalendarModeTypes.HEBREW) {
      jewishDate.setJewishDayOfMonth(1);
      setFirstDayOfMonth(jewishDate.getDate().toJSDate());
    }
  }, [date]);

  useEffect(() => {
    if (calendarMode === CalendarModeTypes.GREGORIAN) {
      setFirstDayOfGrid(startOfWeek(firstDayOfMonth));
    }
    if (calendarMode === CalendarModeTypes.HEBREW) {
      jewishDate.setJewishDayOfMonth(1);
      setFirstDayOfGrid(startOfWeek(jewishDate.getDate().toJSDate()));
    }
  }, [firstDayOfMonth]);

  return (
    <CalendarContext.Provider
      value={{
        zmanimJson,
        onNext,
        onPrev,
        date,
        firstDayOfMonth,
        firstDayOfGrid,
        handleSetDate,
        handleDayClick,
        selectedDay,
        toggleCalendar,
        isHebrew,
        calendarMode,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
};

export { CalendarContext, CalendarProvider };
