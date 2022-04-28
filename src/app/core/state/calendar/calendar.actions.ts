import { NavigationDirection } from '@shared/types';
import { CalendarDayModel } from './calendar.models';

export class NavigateCalendar {
  static readonly type = '[Calendar] Navigate calendar';

  constructor(public readonly payload: NavigationDirection) {}
}

export class SelectCalendarDay {
  static readonly type = '[Calendar] Select calendar day';

  constructor(public readonly payload: CalendarDayModel) {}
}

export class ToggleCalendarMode {
  static readonly type = '[Calendar] Toggle calendar mode';
}

export class GenerateCalendarDays {
  static readonly type = '[Calendar] Generate calendar days';
}
