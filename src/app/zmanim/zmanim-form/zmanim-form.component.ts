import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AppState, FetchZmanim, ZmanimStateModel } from '@core/state';
import { Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { TuiDay } from '@taiga-ui/cdk';
import { Select, Store } from '@ngxs/store';

@Component({
  selector: 'app-zmanim-form',
  templateUrl: './zmanim-form.component.html',
  styleUrls: ['./zmanim-form.component.scss'],
})
export class ZmanimFormComponent implements OnInit, OnDestroy {
  @Select(AppState.zmanim) state$!: Observable<ZmanimStateModel>;

  readonly form: FormGroup = this.fb.group({
    date: [null, [Validators.required]],
  });

  private readonly onDestroy$: Subscription = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly store: Store,
  ) {}

  ngOnInit(): void {
    this.initSyncStateToForm();
  }

  ngOnDestroy(): void {
    this.onDestroy$.unsubscribe();
  }

  private initSyncStateToForm(): void {
    this.onDestroy$.add(
      this.state$.pipe(map(({ form }) => form)).subscribe(({ date }) => {
        this.form.patchValue({ date: TuiDay.fromLocalNativeDate(date) });
      }),
    );
  }

  onGetClicked() {
    this.store.dispatch(
      new FetchZmanim({
        date: (this.form.value.date as TuiDay).toLocalNativeDate(),
      }),
    );
  }
}
