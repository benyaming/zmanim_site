import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {LocationMapComponent} from './location-map.component';
import {AgmCoreModule} from '@agm/core';
import {MatInputModule} from '@angular/material/input';
import {ReactiveFormsModule} from '@angular/forms';


@NgModule({
  declarations: [LocationMapComponent],
  imports: [
    CommonModule,
    AgmCoreModule,
    MatInputModule,
    ReactiveFormsModule
  ],
  exports: [
    LocationMapComponent
  ]
})
export class LocationMapModule { }
