import { LocationWithoutSourceModel, ZmanimFormModel } from './app.models';

export class ChangeBrowserTabTitle {
  static readonly type = '[App] Change browser tab title';

  constructor(public readonly browserTabTitle: string) {}
}

export class ChangeCurrentLanguage {
  static readonly type = '[App] Change current language';

  constructor(public readonly currentLanguage: string) {}
}

export class SetLocationFromNavigator {
  static readonly type = '[App] Set Location from navigator';
}

export class SetLocationFromGeoip {
  static readonly type = '[App] Set Location from geoip';
}

export class SetLocationManually {
  static readonly type = '[App] Set location';

  constructor(public readonly location: LocationWithoutSourceModel) {}
}

export class FetchZmanim {
  static readonly type = '[App] Fetch zmanim';

  constructor(public readonly form: ZmanimFormModel) {}
}
