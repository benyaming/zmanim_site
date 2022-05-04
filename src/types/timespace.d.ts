declare module '@mapbox/timespace' {
  import '@mapbox/timespace';
  import momentTimezone = require('moment-timezone');
  export type MomentTimezone = momentTimezone.MomentTimezone;
  export type Moment = momentTimezone.Moment & { _z: { name: string } };
  function getFuzzyLocalTimeFromPoint(timestamp: number, point: [number, number]): Moment;
}
