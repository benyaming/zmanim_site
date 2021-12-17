import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {ZmanimParamsModel} from './zmanim-params.model';
import {ZmanimInfoModel} from './zmanim-info.model';
import {CoordsModel} from './coords.model';
import {filter} from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class StoreService {
  private readonly _coords$: BehaviorSubject<CoordsModel | null> = new BehaviorSubject<CoordsModel>(null);
  readonly coords$: Observable<CoordsModel> = this._coords$.pipe(
    filter((coords) => !!coords)
  );

  private readonly _zmanimParams$: BehaviorSubject<ZmanimParamsModel> = new BehaviorSubject<ZmanimParamsModel>({
    date: new Date()
  });
  readonly zmanimParams$: Observable<ZmanimParamsModel> = this._zmanimParams$.asObservable();

  private readonly _zmanimInfo$: BehaviorSubject<ZmanimInfoModel> = new BehaviorSubject<ZmanimInfoModel>({
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
  readonly zmanimInfo$: Observable<ZmanimInfoModel> = this._zmanimInfo$.asObservable();

  setCoords(coords: CoordsModel): void {
    const state: CoordsModel | null = this._coords$.value;

    // NOTE: I've tried to make this as readable as possible, but anyway long story short
    // here we have priorities for coordinates based on their source. So for example
    // if user allowed location access and his coordinates from the browser API are already saved
    // when the app gets the response from geoip it should not override coordinates that are already stored
    switch (coords.source) {
      case 'map':
      case 'manual':
        this._coords$.next(coords);
        break;
      case 'navigator':
        if (state?.source !== 'map' && state?.source !== 'manual') {
          this._coords$.next(coords);
        }
        break;
      case 'geoip':
        if (state?.source !== 'map' && state?.source !== 'manual' && state?.source !== 'navigator') {
          this._coords$.next(coords);
        }
        break;
    }
  }

  setZmanimParams(params: ZmanimParamsModel): void {
    this._zmanimParams$.next(params);
  }

  setZmanimInfo(zmanim: ZmanimInfoModel): void {
    this._zmanimInfo$.next(zmanim);
  }
}
