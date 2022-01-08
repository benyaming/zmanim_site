import { LocationWithoutSourceModel, ZmanimFormModel } from './app.models';

export class FetchLocationFromNavigator {
  static readonly type = '[App] Fetch Location from Navigator';
}

export class FetchLocationFromFreegeoip {
  static readonly type = '[App] Fetch Location from Freegeoip';
}

export class SetLocationManually {
  static readonly type = '[App] Set location';

  constructor(public readonly location: LocationWithoutSourceModel) {}
}

export class FetchZmanim {
  static readonly type = '[App] Fetch Zmanim';

  constructor(public readonly form: ZmanimFormModel) {}
}
