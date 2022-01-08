import { Component, OnDestroy, OnInit } from '@angular/core';
import { ZmanimService } from '@core/zmanim';
import { Observable, Subscription } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { Title } from '@angular/platform-browser';
import {
  AppState,
  AppStateModel,
  FetchLocationFromFreegeoip,
  FetchLocationFromNavigator,
  FetchZmanim,
} from '@core/state';
import { Actions, ofActionSuccessful, Select, Store } from '@ngxs/store';
import { map, take } from 'rxjs/operators';

@Component({
  selector: 'app-zmanim',
  templateUrl: './zmanim.component.html',
  styleUrls: ['./zmanim.component.scss'],
})
export class ZmanimComponent implements OnInit, OnDestroy {
  @Select(AppState) state$!: Observable<AppStateModel>;

  private readonly onDestroy$: Subscription = new Subscription();

  constructor(
    private readonly zmanimService: ZmanimService,
    private readonly translateService: TranslateService,
    private readonly title: Title,
    private readonly actions$: Actions,
    private readonly store: Store,
  ) {}

  ngOnInit(): void {
    this.initTitleChange();
    this.initOneTimeZmanimFetch();
  }

  ngOnDestroy(): void {
    this.onDestroy$.unsubscribe();
  }

  private initTitleChange(): void {
    this.onDestroy$.add(
      this.translateService.get('zmanim.tab-title').subscribe((title) => {
        this.title.setTitle(title);
      }),
    );
  }

  private initOneTimeZmanimFetch() {
    this.onDestroy$.add(
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
        }),
    );
  }
}
