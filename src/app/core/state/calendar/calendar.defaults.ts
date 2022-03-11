import { CalendarStateModel } from '@core/state';
import { startOfMonth } from 'date-fns';

export const CALENDAR_DEFAULTS: CalendarStateModel = {
  displayedPeriodDate: startOfMonth(new Date()),
  selectedDay: null,
  days: [],
};
