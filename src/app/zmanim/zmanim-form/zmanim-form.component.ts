import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AppState, FetchZmanim, ZmanimModel } from '@core/state';
import { Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { TUI_DATE_SEPARATOR, TuiDay } from '@taiga-ui/cdk';
import { Select, Store } from '@ngxs/store';
import { add, sub } from 'date-fns';

@Component({
  selector: 'app-zmanim-form',
  templateUrl: './zmanim-form.component.html',
  styleUrls: ['./zmanim-form.component.scss'],
  providers: [{ provide: TUI_DATE_SEPARATOR, useValue: '.' }],
})
export class ZmanimFormComponent implements OnInit, OnDestroy {
  @Select(AppState.zmanim)
  private readonly zmanim$!: Observable<ZmanimModel>;

  form: FormGroup = this.fb.group({
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
      this.zmanim$.pipe(map(({ form }) => form)).subscribe(({ date }) => {
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

  onDateBtnClick(direction: 'sub' | 'add') {
    const { day, year, month } = this.form.value.date;
    const date = new Date(year, month, day);
    if (direction === 'add')
      return this.form.patchValue({
        date: TuiDay.fromLocalNativeDate(add(date, { days: 1 })),
      });
    return this.form.patchValue({
      date: TuiDay.fromLocalNativeDate(sub(date, { days: 1 })),
    });
  }
}
