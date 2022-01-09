import { Component, OnInit } from '@angular/core';
import { ZmanimService } from '@core/zmanim';
import { TranslateService } from '@ngx-translate/core';
import { Title } from '@angular/platform-browser';
import {
  AppState,
  ChangeBrowserTabTitle,
  FetchLocationFromFreegeoip,
  FetchLocationFromNavigator,
  FetchZmanim,
} from '@core/state';
import { Actions, ofActionSuccessful, Store } from '@ngxs/store';
import { map, take } from 'rxjs/operators';

@Component({
  selector: 'app-zmanim',
  templateUrl: './zmanim.component.html',
  styleUrls: ['./zmanim.component.scss'],
})
export class ZmanimComponent implements OnInit {
  constructor(
    private readonly zmanimService: ZmanimService,
    private readonly translateService: TranslateService,
    private readonly title: Title,
    private readonly actions$: Actions,
    private readonly store: Store,
  ) {}

  ngOnInit(): void {
    this.initOneTimeZmanimFetch();
    this.updateStore();
  }

  private initOneTimeZmanimFetch() {
    this.actions$
      .pipe(
        ofActionSuccessful(
          FetchLocationFromNavigator,
          FetchLocationFromFreegeoip,
        ),
        take(1),
        map(() => this.store.selectSnapshot(AppState.zmanim)),
      )
      .subscribe(({ form }) => {
        this.store.dispatch(new FetchZmanim(form));
      });
  }

  private updateStore(): void {
    this.store.dispatch(new ChangeBrowserTabTitle('zmanim.browser-tab-title'));
  }
}
