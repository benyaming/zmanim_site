export interface ZmanimZmanimRequestDto {
  readonly sunrise?: boolean;
  readonly alos?: boolean;
  readonly sof_zman_tefila_gra?: boolean;
  readonly sof_zman_tefila_ma?: boolean;
  readonly misheyakir_10_2?: boolean;
  readonly sof_zman_shema_gra?: boolean;
  readonly sof_zman_shema_ma?: boolean;
  readonly chatzos?: boolean;
  readonly mincha_ketana?: boolean;
  readonly mincha_gedola?: boolean;
  readonly plag_mincha?: boolean;
  readonly sunset?: boolean;
  readonly tzeis_8_5_degrees?: boolean;
  readonly tzeis_72_minutes?: boolean;
  readonly tzeis_42_minutes?: boolean;
  readonly tzeis_5_95_degrees?: boolean;
  readonly chatzot_laila?: boolean;
  readonly astronomical_hour_ma?: boolean;
  readonly astronomical_hour_gra?: boolean;
}

export interface ZmanimZmanimResponseDto extends Readonly<Record<string, any>> {
  readonly settings?: ZmanimSettingsResponseDto;
  readonly alos: string | null;
  readonly sunrise: string | null;
  readonly misheyakir_10_2: string | null;
  readonly sof_zman_shema_ma: string | null;
  readonly sof_zman_shema_gra: string | null;
  readonly sof_zman_tefila_ma: string | null;
  readonly sof_zman_tefila_gra: string | null;
  readonly chatzos: string | null;
  readonly mincha_gedola: string | null;
  readonly mincha_ketana: string | null;
  readonly plag_mincha: string | null;
  readonly sunset: string | null;
  readonly tzeis_5_95_degrees: string | null;
  readonly tzeis_8_5_degrees: string | null;
  readonly tzeis_42_minutes: string | null;
  readonly tzeis_72_minutes: string | null;
  readonly chatzot_laila: string | null;
  readonly astronomical_hour_ma: string | null;
  readonly astronomical_hour_gra: string | null;
}

export interface ZmanimSettingsResponseDto {
  readonly date?: string;
  readonly jewish_date?: string;
  readonly holiday_name?: string;
  readonly cl_offset?: number;
  readonly havdala_opinion?: string;
  readonly coordinates?: string[];
  readonly elevation?: number;
  readonly fast_name?: string;
  readonly yomtov_name?: string;
}
