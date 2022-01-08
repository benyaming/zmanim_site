export interface ZmanimResponseDto {
  settings?: {
    date?: string;
    jewish_date?: string;
    holiday_name?: string;
    cl_offset?: number;
    havdala_opinion?: string;
    coordinates?: string[];
    elevation?: number;
    fast_name?: string;
    yomtov_name?: string
  };
  alos: string | null;
  sunrise: string | null;
  misheyakir_10_2: string | null;
  sof_zman_shema_ma: string | null;
  sof_zman_shema_gra: string | null;
  sof_zman_tefila_ma: string | null;
  sof_zman_tefila_gra: string | null;
  chatzos: string | null;
  mincha_gedola: string | null;
  mincha_ketana: string | null;
  plag_mincha: string | null;
  sunset: string | null;
  tzeis_5_95_degrees: string | null;
  tzeis_8_5_degrees: string | null;
  tzeis_42_minutes: string | null;
  tzeis_72_minutes: string | null;
  chatzot_laila: string | null;
  astronomical_hour_ma: string | null;
  astronomical_hour_gra: string | null;
}
