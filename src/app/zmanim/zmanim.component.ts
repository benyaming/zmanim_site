import {Component, OnDestroy} from '@angular/core';
import {ZmanimQueryParams, ZmanimRequestDto, ZmanimService} from '@core/zmanim';
import {Subscription} from 'rxjs';
import {AppStore, CoordsModel, ZmanimParamsModel} from '@core/store';
import {format} from 'date-fns';


@Component({
  selector: 'app-zmanim',
  templateUrl: './zmanim.component.html',
  styleUrls: ['./zmanim.component.scss']
})
export class ZmanimComponent implements OnDestroy {
  private readonly sub$: Subscription = new Subscription();

  constructor(
    private readonly zmanimService: ZmanimService,
    private readonly appStore: AppStore
  ) {
  }

  ngOnDestroy(): void {
    this.sub$.unsubscribe();
  }

  fetchZmanim(): void {
    const {date}: ZmanimParamsModel = this.appStore.getZmanimParamsSnapshot();
    const {lat, lng}: CoordsModel = this.appStore.getCoordsSnapshot();
    const query: ZmanimQueryParams = {
      date: format(date, 'yyyy-MM-dd'),
      lat: lat.toString(),
      lng: lng.toString()
    };

    this.sub$.add(
      this.zmanimService.fetchZmanim(ZMANIM_BODY, query).subscribe((zmanim) => {
        this.appStore.setZmanimInfo(zmanim);
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
