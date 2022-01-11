export interface FreegeoipResponseDto {
  readonly ip: string;
  readonly country_code: string;
  readonly country_name: string;
  readonly region_code: string;
  readonly region_name: string;
  readonly city: string;
  readonly zip_code: string;
  readonly time_zone: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly metro_code: number;
}
