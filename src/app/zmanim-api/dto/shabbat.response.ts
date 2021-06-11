export interface ShabbatResponse {
  'date': string;
  'candle_lighting': string;
  'havdala': string;
  'settings': {
    'date': string;
    'jewish_date': string;
    'holiday_name': string;
    'cl_offset': number;
    'havdala_opinion': string;
    'coordinates': string[];
    'elevation': number;
    'fast_name': string;
    'yomtov_name': string;
  };
  'torah_part': string;
  'late_cl_warning': boolean;
}
