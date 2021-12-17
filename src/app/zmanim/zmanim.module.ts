import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ZmanimRoutingModule} from './zmanim-routing.module';
import {ZmanimComponent} from './zmanim.component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {ZmanimFormComponent} from './zmanim-form/zmanim-form.component';
import {ZmanimInfoComponent} from './zmanim-info/zmanim-info.component';
import {DefaultLayoutModule} from '@shared/layout';
import {TuiInputDateModule, TuiInputNumberModule} from '@taiga-ui/kit';
import {TuiGroupModule} from '@taiga-ui/core';


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
    DefaultLayoutModule,
    ZmanimRoutingModule,
    TuiInputDateModule,
    TuiInputNumberModule,
    TuiGroupModule,
  ]
})
export class ZmanimModule {
}
