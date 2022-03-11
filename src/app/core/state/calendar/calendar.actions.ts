import { NavigationDirection } from '@shared/types';
import { CalendarDayModel } from './calendar.models';

export class NavigateCalendar {
  static readonly type = '[App] Navigate calendar';

  constructor(public readonly payload: NavigationDirection) {}
}

export class SelectCalendarDay {
  static readonly type = '[App] Select calendar day';

  constructor(public readonly payload: CalendarDayModel) {}
}

export class GenerateCalendarDays {
  static readonly type = '[App] Generate calendar days';
}
