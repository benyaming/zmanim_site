import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {AppStore} from '@core/store';
import {Subscription} from 'rxjs';
import {debounceTime, filter, map} from 'rxjs/operators';

@Component({
  selector: 'app-zmanim-form',
  templateUrl: './zmanim-form.component.html',
  styleUrls: ['./zmanim-form.component.scss']
})
export class ZmanimFormComponent implements OnInit, OnDestroy {
  form: FormGroup = this.fb.group({
    date: [null, Validators.required],
    // lat: [null, Validators.required],
    // lng: [null, Validators.required]
  });

  private readonly sub$: Subscription = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly appStore: AppStore
  ) {
  }

  ngOnInit(): void {
    this.initForm();
  }

  ngOnDestroy(): void {
    this.sub$.unsubscribe();
  }

  private initForm(): void {
    this.sub$.add(
      this.appStore.zmanimParams$.subscribe(params => {
        this.form.patchValue(params, {emitEvent: false});
      })
    );

    this.sub$.add(
      this.form.valueChanges.pipe(
        filter(() => this.form.valid),
        debounceTime(100),
        map((value) => value as {date: Date})
      ).subscribe((value) => {
        this.appStore.setZmanimParams(value);
      })
    );
  }
}
