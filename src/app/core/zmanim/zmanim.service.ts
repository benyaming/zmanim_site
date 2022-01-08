import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ZmanimResponseDto} from './zmanim.response-dto';
import {ZmanimRequestDto} from './zmanim.request-dto';
import {ZmanimQueryParams} from './zmanim.query-params';

// NOTE: In terms of project the word "zmanim" has two meanings: the API itself and one of its endpoints.
// The current service is named after the whole API itself,
// but the method zmanimService.fetchZmanim() and ZmanimModule are named after the endpoint
@Injectable({
  providedIn: 'root'
})
export class ZmanimService {
  readonly urlPrefix = `zmanim/`;

  constructor(
    private readonly http: HttpClient
  ) {
  }

  fetchZmanim(params: ZmanimQueryParams): Observable<ZmanimResponseDto> {
    return this.http.post<ZmanimResponseDto>(`${this.urlPrefix}zmanim`, ZMANIM_BODY, {params});
  }
}

const ZMANIM_BODY: ZmanimRequestDto = {
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
  astronomical_hour_gra: true
};
