import {Component, OnDestroy, OnInit} from '@angular/core';
import {ZmanimQueryParams, ZmanimRequestDto, ZmanimService} from '@core/zmanim';
import {combineLatest, Subscription} from 'rxjs';
import {CoordsModel, StoreService, ZmanimParamsModel} from '@core/store';
import {format} from 'date-fns';
import {map} from 'rxjs/operators';
import {TranslateService} from '@ngx-translate/core';
import {Title} from '@angular/platform-browser';


@Component({
  selector: 'app-zmanim',
  templateUrl: './zmanim.component.html',
  styleUrls: ['./zmanim.component.scss']
})
export class ZmanimComponent implements OnInit, OnDestroy {
  private readonly onDestroy$: Subscription = new Subscription();
  private fetchSub$?: Subscription;

  constructor(
    private readonly zmanimService: ZmanimService,
    private readonly storeService: StoreService,
    private readonly translateService: TranslateService,
    private readonly title: Title
  ) {
  }

  static mapStateToQueryParams(coords: CoordsModel, params: ZmanimParamsModel): ZmanimQueryParams {
    return {
      date: format(params.date, 'yyyy-MM-dd'),
      lat: coords.lat.toString(),
      lng: coords.lng.toString()
    };
  }

  ngOnInit(): void {
    this.initZmanimFetchOnStateChange();
    this.initTitleChange();
  }

  ngOnDestroy(): void {
    this.onDestroy$.unsubscribe();
  }

  private initZmanimFetchOnStateChange(): void {
    this.onDestroy$.add(
      combineLatest([
        this.storeService.coords$,
        this.storeService.zmanimParams$
      ]).pipe(
        map(([coords, params]) => ZmanimComponent.mapStateToQueryParams(coords, params)),
      ).subscribe((query) => this.initZmanimFetch(query))
    );
  }

  private initZmanimFetch(query: ZmanimQueryParams): void {
    this.fetchSub$?.unsubscribe();
    this.fetchSub$ = this.zmanimService.fetchZmanim(ZMANIM_BODY, query)
      .subscribe(({settings, ...zmanim}) => {
        this.storeService.setZmanimInfo(zmanim);
      });
  }

  private initTitleChange(): void {
    this.onDestroy$.add(
      this.translateService.get('title')
        .subscribe(title => {
          this.title.setTitle(title);
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
