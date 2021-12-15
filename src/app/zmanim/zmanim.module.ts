import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ZmanimRoutingModule} from './zmanim-routing.module';
import {ZmanimComponent} from './zmanim.component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatRadioModule} from '@angular/material/radio';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatNativeDateModule} from '@angular/material/core';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {ZmanimFormComponent} from './zmanim-form/zmanim-form.component';
import {ZmanimInfoComponent} from './zmanim-info/zmanim-info.component';
import {AgmCoreModule} from '@agm/core';
import {ZmanimMapComponent} from './zmanim-map/zmanim-map.component';


@NgModule({
  declarations: [
    ZmanimComponent,
    ZmanimFormComponent,
    ZmanimInfoComponent,
    ZmanimMapComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatRadioModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonToggleModule,
    AgmCoreModule,
    ZmanimRoutingModule,
  ]
})
export class ZmanimModule {
}
