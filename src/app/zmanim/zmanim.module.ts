import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ZmanimRoutingModule } from './zmanim-routing.module';
import { ZmanimComponent } from './zmanim.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ZmanimFormComponent } from './zmanim-form/zmanim-form.component';
import { ZmanimInfoComponent } from './zmanim-info/zmanim-info.component';
import { DefaultLayoutModule } from '@shared/layout';
import {
  TuiInputDateModule,
  TuiInputNumberModule,
  TuiIslandModule,
} from '@taiga-ui/kit';
import { TuiButtonModule, TuiGroupModule } from '@taiga-ui/core';
import { TranslateModule } from '@ngx-translate/core';
import { TuiTableModule } from '@taiga-ui/addon-table';

@NgModule({
  declarations: [ZmanimComponent, ZmanimFormComponent, ZmanimInfoComponent],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DefaultLayoutModule,
    ZmanimRoutingModule,
    TuiInputDateModule,
    TuiInputNumberModule,
    TuiGroupModule,
    TranslateModule,
    TuiTableModule,
    TuiButtonModule,
    TuiIslandModule,
  ],
})
export class ZmanimModule {}
