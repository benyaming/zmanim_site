import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {ZmanimParams} from './dto/zmanim.params';
import {ZmanimResponseDto} from './dto/zmanim-response.dto';

@Injectable({
  providedIn: 'root'
})
export class ZmanimStore {
  private readonly _params$: BehaviorSubject<ZmanimParams> = new BehaviorSubject<ZmanimParams>({
    date: null,
    lat: 55.5,
    lng: 37.7,
  });
  params$: Observable<ZmanimParams> = this._params$.asObservable();

  private readonly _zmanim$: BehaviorSubject<ZmanimResponseDto> = new BehaviorSubject<ZmanimResponseDto>({
    settings: {
      date: null,
      jewish_date: null,
      holiday_name: null,
      cl_offset: null,
      havdala_opinion: null,
      coordinates: [],
      elevation: null,
      fast_name: null,
      yomtov_name: null
    },
    alos: null,
    sunrise: null,
    misheyakir_10_2: null,
    sof_zman_shema_ma: null,
    sof_zman_shema_gra: null,
    sof_zman_tefila_ma: null,
    sof_zman_tefila_gra: null,
    chatzos: null,
    mincha_gedola: null,
    mincha_ketana: null,
    plag_mincha: null,
    sunset: null,
    tzeis_5_95_degrees: null,
    tzeis_8_5_degrees: null,
    tzeis_42_minutes: null,
    tzeis_72_minutes: null,
    chatzot_laila: null,
    astronomical_hour_ma: null,
    astronomical_hour_gra: null
  });
  zmanim$: Observable<ZmanimResponseDto> = this._zmanim$.asObservable();

  setParams(params: ZmanimParams): void {
    this._params$.next(params);
  }

  setLocation({lat, lng}: Pick<ZmanimParams, 'lat' | 'lng'>): void {
    const state: ZmanimParams = this._params$.value;
    this._params$.next({
      ...state,
      lat,
      lng
    });
  }

  setZmanim(zmanim: ZmanimResponseDto): void {
    this._zmanim$.next(zmanim);
  }
}
