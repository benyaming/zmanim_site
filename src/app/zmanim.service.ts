import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ZmanimResponse} from './zmanim-response';

@Injectable({
  providedIn: 'root'
})
export class ZmanimService {

  // manimUrl = 'api';

  constructor(
    private readonly httpClient: HttpClient
  ) {
  }

  getZmanim(lat: number, lng: number, date: string): Observable<ZmanimResponse> {
    const z = {
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
    const params = {
      date,
      lat: lat.toString(),
      lng: lng.toString(),
    };
    return this.httpClient.post<ZmanimResponse>(`zmanim`, z, {params});
  }
}
