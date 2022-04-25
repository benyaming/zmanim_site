import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ZmanimZmanimRequestDto, ZmanimZmanimResponseDto } from './zmanim.dtos';
import { ZmanimZmanimQueryParams } from './zmanim.query-params';
import * as KosherZmanim from 'kosher-zmanim';
import { JsonOutput, Options } from 'kosher-zmanim';

// NOTE: In terms of project the word "zmanim" has two meanings: the API itself and one of its endpoints.
// The current service is named after the whole API itself,
// but the method zmanimService.fetchZmanim() and ZmanimModule are named after the endpoint
@Injectable({
  providedIn: 'root',
})
export class ZmanimService {
  static readonly fullZmanimZmanimRequestDto: ZmanimZmanimRequestDto = {
    sunrise: true,
    alos: true,
    sof_zman_tefila_gra: true,
    sof_zman_tefila_ma: true,
    misheyakir_10_2: true,
    sof_zman_shema_gra: true,
    sof_zman_shema_ma: true,
    chatzos: true,
    mincha_ketana: true,
    mincha_gedola: true,
    plag_mincha: true,
    sunset: true,
    tzeis_8_5_degrees: true,
    tzeis_72_minutes: true,
    tzeis_42_minutes: true,
    tzeis_5_95_degrees: true,
    chatzot_laila: true,
    astronomical_hour_ma: true,
    astronomical_hour_gra: true,
  };

  readonly urlPrefix = `zmanim/`;
  kosherZmanim;

  constructor(private readonly http: HttpClient) {
    this.kosherZmanim = KosherZmanim;
  }

  fetchZmanim(
    params: ZmanimZmanimQueryParams,
  ): Observable<ZmanimZmanimResponseDto> {
    return this.http.post<ZmanimZmanimResponseDto>(
      `${this.urlPrefix}zmanim`,
      ZmanimService.fullZmanimZmanimRequestDto,
      { params },
    );
  }

  getZmanim(options: Options): JsonOutput {
    return this.kosherZmanim.getZmanimJson(options);
  }
}
