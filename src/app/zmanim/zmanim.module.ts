import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ZmanimRoutingModule} from './zmanim-routing.module';
import {ZmanimComponent} from './zmanim.component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {ZmanimFormComponent} from './zmanim-form/zmanim-form.component';
import {ZmanimInfoComponent} from './zmanim-info/zmanim-info.component';
import {DefaultLayoutModule} from '@shared/layout';


@NgModule({
  declarations: [
    ZmanimComponent,
    ZmanimFormComponent,
    ZmanimInfoComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    DefaultLayoutModule,
    ZmanimRoutingModule,
  ]
})
export class ZmanimModule {
}
