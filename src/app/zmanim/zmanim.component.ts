import { Component, OnDestroy, OnInit } from '@angular/core';
import { ZmanimService } from '@core/zmanim';
import { Observable, Subscription } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { Title } from '@angular/platform-browser';
import { AppState, AppStateModel } from '@core/state';
import { Select } from '@ngxs/store';

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
  ) {}

  ngOnInit(): void {
    this.initTitleChange();
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
}
