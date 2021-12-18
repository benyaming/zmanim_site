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
  alos?: string;
  sunrise?: string;
  misheyakir_10_2?: string;
  sof_zman_shema_ma?: string;
  sof_zman_shema_gra?: string;
  sof_zman_tefila_ma?: string;
  sof_zman_tefila_gra?: string;
  chatzos?: string;
  mincha_gedola?: string;
  mincha_ketana?: string;
  plag_mincha?: string;
  sunset?: string;
  tzeis_5_95_degrees?: string;
  tzeis_8_5_degrees?: string;
  tzeis_42_minutes?: string;
  tzeis_72_minutes?: string;
  chatzot_laila?: string;
  astronomical_hour_ma?: string;
  astronomical_hour_gra?: string;
}
