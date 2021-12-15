import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ZmanimResponseDto} from './dto/zmanim-response.dto';
import {ZmanimRequestDto} from './dto/zmanim-request.dto';
import {ZmanimParams} from './dto/zmanim.params';

@Injectable({
  providedIn: 'root'
})
export class ZmanimService {
  constructor(
    private readonly http: HttpClient
  ) {
  }

  getZmanim({date, lat, lng}: ZmanimParams): Observable<ZmanimResponseDto> {
    const body: ZmanimRequestDto = {
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

    const params: HttpParams = new HttpParams();
    params.set('date', date);
    params.set('lat', lat.toString());
    params.set('lng', lng.toString());

    return this.http.post<ZmanimResponseDto>(`zmanim`, body, {params});
  }
}
