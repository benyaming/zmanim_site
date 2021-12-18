import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {CoordsModel, StoreService} from '@core/store';
import {Subscription} from 'rxjs';
import {debounceTime, filter, map} from 'rxjs/operators';
import {TuiDay} from '@taiga-ui/cdk';
import {OPTIONALLY_DECIMAL_NUMBER} from '@shared/regexp';

@Component({
  selector: 'app-zmanim-form',
  templateUrl: './zmanim-form.component.html',
  styleUrls: ['./zmanim-form.component.scss']
})
export class ZmanimFormComponent implements OnInit, OnDestroy {
  readonly form: FormGroup = this.fb.group({
    params: this.fb.group({
      date: [null, [Validators.required]],
    }),
    coords: this.fb.group({
      lat: [null, [Validators.required, Validators.pattern(OPTIONALLY_DECIMAL_NUMBER)]],
      lng: [null, [Validators.required, Validators.pattern(OPTIONALLY_DECIMAL_NUMBER)]]
    })
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
        const params = {date: TuiDay.fromLocalNativeDate(date)};
        this.form.patchValue({params}, {emitEvent: false});
      })
    );
    this.onDestroy$.add(
      this.storeService.coords$.subscribe((coords) => {
        this.form.patchValue({coords}, {emitEvent: false});
      })
    );
  }

  private initSyncFormToState(): void {
    this.onDestroy$.add(
      this.form.get('params').valueChanges.pipe(
        filter(() => this.form.get('params').valid),
        debounceTime(300),
        map(({date}) => (date as TuiDay).toLocalNativeDate())
      ).subscribe((date) => {
        this.storeService.setZmanimParams({date});
      })
    );

    this.onDestroy$.add(
      this.form.get('coords').valueChanges.pipe(
        filter(() => this.form.get('coords').valid),
        debounceTime(300),
        map((coords) => coords as Pick<CoordsModel, 'lat' | 'lng'>)
      ).subscribe(({lat, lng}) => {
        this.storeService.setCoords({lat, lng, source: 'manual'});
      })
    );
  }
}
