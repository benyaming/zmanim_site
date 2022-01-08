import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {StoreService} from '@core/store';
import {Subscription} from 'rxjs';
import {debounceTime, filter, map} from 'rxjs/operators';
import {TuiDay} from '@taiga-ui/cdk';

@Component({
  selector: 'app-zmanim-form',
  templateUrl: './zmanim-form.component.html',
  styleUrls: ['./zmanim-form.component.scss']
})
export class ZmanimFormComponent implements OnInit, OnDestroy {
  readonly form: FormGroup = this.fb.group({
    date: [null, [Validators.required]],
  });

  private readonly onDestroy$: Subscription = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly storeService: StoreService,
  ) {
  }

  ngOnInit(): void {
    this.initSyncStateToForm();
    this.initSyncFormToState();
  }

  ngOnDestroy(): void {
    this.onDestroy$.unsubscribe();
  }

  private initSyncStateToForm(): void {
    this.onDestroy$.add(
      this.storeService.zmanimParams$.subscribe(({date}) => {
        this.form.patchValue({date: TuiDay.fromLocalNativeDate(date)}, {emitEvent: false});
      })
    );
  }

  private initSyncFormToState(): void {
    this.onDestroy$.add(
      this.form.valueChanges.pipe(
        filter(() => this.form.valid),
        debounceTime(300),
        map(({date}) => (date as TuiDay).toLocalNativeDate())
      ).subscribe((date) => {
        this.storeService.setZmanimParams({date});
      })
    );
  }
}
