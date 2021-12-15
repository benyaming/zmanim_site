import {Component, OnDestroy, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, Validators} from '@angular/forms';
import {ZmanimStore} from '../zmanim.store';
import {Subscription} from 'rxjs';
import {filter} from 'rxjs/operators';

@Component({
  selector: 'app-zmanim-form',
  templateUrl: './zmanim-form.component.html',
  styleUrls: ['./zmanim-form.component.scss']
})
export class ZmanimFormComponent implements OnInit, OnDestroy {
  form: FormGroup = this.fb.group({
    date: [null, Validators.required],
    lat: [null, Validators.required],
    lng: [null, Validators.required]
  });

  private readonly sub$: Subscription = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly store: ZmanimStore
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
      this.store.params$.subscribe(state => {
        this.form.patchValue(state, {emitEvent: false});
      })
    );

    this.sub$.add(
      this.form.valueChanges.pipe(
        filter(() => this.form.valid)
      ).subscribe(value => {
        this.store.setParams(value);
      })
    );
  }
}
