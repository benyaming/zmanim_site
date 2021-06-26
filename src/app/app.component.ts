import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {ZmanimResponse} from './zmanim-api/dto/zmanim.response';
import {ZmanimApiService} from './zmanim-api/zmanim-api.service';
import {Observable} from 'rxjs';
import {filter, switchMap} from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'zmanim-site';
  optionsForm: FormGroup;

  zmanim$: Observable<ZmanimResponse> = null;

  constructor(
    private fb: FormBuilder,
    private zmanimService: ZmanimApiService
  ) {
  }

  get coordinates(): FormGroup {
    return this.optionsForm.get('coordinates') as FormGroup;
  }

  get lngControl(): FormControl {
    return this.coordinates.get('lng') as FormControl;
  }

  get latControl(): FormControl {
    return this.coordinates.get('lat') as FormControl;
  }

  ngOnInit(): void {
    this.optionsForm = this.fb.group({
      date: this.fb.control('', Validators.required),
      coordinates: this.fb.group({
        lat: this.fb.control('', Validators.required),
        lng: this.fb.control('', Validators.required)
      })
    });

    this.zmanim$ = this.optionsForm.valueChanges
      .pipe(
        filter(() => this.optionsForm.valid),
        switchMap(
          value =>
            this.zmanimService.getZmanim(
              value.coordinates.lat,
              value.coordinates.lng,
              new Date(value.date).toISOString().substring(0, 10)
            )
        )
      );
  }

  setCoordinates($event: FormGroup): void {
    this.lngControl.patchValue($event.get('lng').value);
    this.latControl.patchValue($event.get('lat').value);
  }

}
