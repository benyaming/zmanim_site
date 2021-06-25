import {Component, EventEmitter, OnInit, Output} from '@angular/core';
import {Marker} from './marker.type';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';


@Component({
  selector: 'app-location-map',
  templateUrl: './location-map.component.html',
  styleUrls: ['./location-map.component.css']
})
export class LocationMapComponent implements OnInit {

  @Output() outputMarker = new EventEmitter<FormGroup>();

  coordinatesForm: FormGroup;

  // google maps zoom level
  zoom = 8;

  firstMarker: Marker = {
    lat: 55.5,
    lng: 37.7,
    draggable: true
  };

  constructor(
    private fb: FormBuilder,
  ) {}


  ngOnInit(): void {
    this.coordinatesForm = this.fb.group({
      lat: this.fb.control(this.firstMarker.lat, Validators.required),
      lng: this.fb.control(this.firstMarker.lng, Validators.required)
    });
  }

  get lngControl(): FormControl {
    return this.coordinatesForm.get('lng') as FormControl;
  }

  get latControl(): FormControl {
    return this.coordinatesForm.get('lat') as FormControl;
  }

  mapClicked($event: any): void {
    this.latControl.patchValue($event.coords.lat);
    this.lngControl.patchValue($event.coords.lng);
    this.outputMarker.emit(this.coordinatesForm);
  }
}
