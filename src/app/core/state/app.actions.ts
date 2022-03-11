import {
  CalendarDayModel,
  LocationWithoutSourceModel,
  ZmanimFormModel,
} from './app.models';
import { NavigationDirection } from '@shared/types';

export class SetBrowserTabTitle {
  static readonly type = '[App] Set browser tab title';

  constructor(public readonly payload: string) {}
}

export class SetCurrentLanguage {
  static readonly type = '[App] Set current language';

  constructor(public readonly payload: string) {}
}

export class SetLocationFromNavigator {
  static readonly type = '[App] Set Location from navigator';
}

export class SetLocationFromGeoip {
  static readonly type = '[App] Set Location from geoip';
}

export class SetLocationManually {
  static readonly type = '[App] Set location';

  constructor(public readonly payload: LocationWithoutSourceModel) {}
}

export class FetchZmanim {
  static readonly type = '[App] Fetch zmanim';

  constructor(public readonly payload: ZmanimFormModel) {}
}

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
