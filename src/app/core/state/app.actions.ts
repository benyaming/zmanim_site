import { LocationWithoutSourceModel, ZmanimFormModel } from './app.models';

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
