import {Component, OnInit} from '@angular/core';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';
import {ZmanimResponse} from './zmanim-api/dto/zmanim.response';
import {ZmanimApiService} from './zmanim-api/zmanim-api.service';
import {Observable, Subscription} from 'rxjs';
import {filter, switchMap} from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'zmanim-site';
  optionsForm: FormGroup;

  formSubscribtion$: Subscription;

  zmanim$: Observable<ZmanimResponse> = null;

  constructor(
    private fb: FormBuilder,
    private zmanimService: ZmanimApiService
  ) {
  }

  ngOnInit(): void {
    this.optionsForm = this.fb.group({
      mode: this.fb.control('', Validators.required),
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

  // updateZmanim(): void {
  //   this.zmanim = this.zmanimService.getZmanim(
  //     this.coordinatesForm.controls[0].value,
  //     this.coordinatesForm.controls[1].value,
  //     this.dateForm.value
  //   );
  // }
}
