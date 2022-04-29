declare module '@mapbox/timespace' {
  import '@mapbox/timespace';
  import momentTimezone = require('moment-timezone');
  export type MomentTimezone = momentTimezone.MomentTimezone;
  function getFuzzyLocalTimeFromPoint(timestamp: number, point: [number, number]): MomentTimezone;
}
