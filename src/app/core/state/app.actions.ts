import { LocationWithoutSourceModel, ZmanimFormModel } from './app.models';

export class ChangeBrowserTabTitle {
  static readonly type = '[App] Change browser tab title';

  constructor(public readonly browserTabTitle: string) {}
}

export class FetchLocationFromNavigator {
  static readonly type = '[App] Fetch Location from navigator';
}

export class FetchLocationFromFreegeoip {
  static readonly type = '[App] Fetch Location from freegeoip';
}

export class SetLocationManually {
  static readonly type = '[App] Set location';

  constructor(public readonly location: LocationWithoutSourceModel) {}
}

export class FetchZmanim {
  static readonly type = '[App] Fetch zmanim';

  constructor(public readonly form: ZmanimFormModel) {}
}
