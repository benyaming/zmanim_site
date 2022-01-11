import { Component, OnInit } from '@angular/core';
import { ZmanimService } from '@core/zmanim';
import { TranslateService } from '@ngx-translate/core';
import { Title } from '@angular/platform-browser';
import {
  AppState,
  ChangeBrowserTabTitle,
  FetchZmanim,
  LocationModel,
} from '@core/state';
import { Actions, Select, Store } from '@ngxs/store';
import { filter, map, take } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-zmanim',
  templateUrl: './zmanim.component.html',
  styleUrls: ['./zmanim.component.scss'],
})
export class ZmanimComponent implements OnInit {
  @Select(AppState.location)
  private readonly location$!: Observable<LocationModel | null>;

  constructor(
    private readonly zmanimService: ZmanimService,
    private readonly translateService: TranslateService,
    private readonly title: Title,
    private readonly actions$: Actions,
    private readonly store: Store,
  ) {}

  ngOnInit(): void {
    this.initOneTimeZmanimFetch();
    this.setBrowserTabTitle();
  }

  private initOneTimeZmanimFetch() {
    this.location$
      .pipe(
        filter((location) => !!location),
        take(1),
        map(() => this.store.selectSnapshot(AppState.zmanim)),
      )
      .subscribe(({ form }) => {
        this.store.dispatch(new FetchZmanim(form));
      });
  }

  private setBrowserTabTitle(): void {
    this.store.dispatch(new ChangeBrowserTabTitle('zmanim.browser-tab-title'));
  }
}
