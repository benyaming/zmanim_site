import {Component, OnDestroy, OnInit} from '@angular/core';
import {ZmanimQueryParams, ZmanimRequestDto, ZmanimService} from '@core/zmanim';
import {combineLatest, Subscription} from 'rxjs';
import {StoreService} from '@core/store';
import {format} from 'date-fns';
import {map, switchMap} from 'rxjs/operators';


@Component({
  selector: 'app-zmanim',
  templateUrl: './zmanim.component.html',
  styleUrls: ['./zmanim.component.scss']
})
export class ZmanimComponent implements OnInit, OnDestroy {
  private readonly sub$: Subscription = new Subscription();

  constructor(
    private readonly zmanimService: ZmanimService,
    private readonly storeService: StoreService
  ) {
  }

  ngOnInit(): void {
    this.initZmanimFetch();
  }

  ngOnDestroy(): void {
    this.sub$.unsubscribe();
  }

  private initZmanimFetch(): void {
    this.sub$.add(
      combineLatest([
        this.storeService.coords$,
        this.storeService.zmanimParams$
      ]).pipe(
        map(([coords, params]) => ({
          date: format(params.date, 'yyyy-MM-dd'),
          lat: coords.lat.toString(),
          lng: coords.lng.toString()
        } as ZmanimQueryParams)),
        switchMap((query) => this.zmanimService.fetchZmanim(ZMANIM_BODY, query))
      ).subscribe((zmanim) => {
        this.storeService.setZmanimInfo(zmanim);
      })
    );
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
