import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ZmanimRoutingModule } from './zmanim-routing.module';
import { ZmanimComponent } from './zmanim.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ZmanimFormComponent } from './zmanim-form/zmanim-form.component';
import { ZmanimConvertFormComponent } from './zmanim-convert-form/zmanim-convert-form.component';
import { ZmanimInfoComponent } from './zmanim-info/zmanim-info.component';
import { DefaultLayoutModule } from '@shared/layout';
import {
  TuiInputDateModule,
  TuiInputModule,
  TuiInputNumberModule,
  TuiIslandModule,
} from '@taiga-ui/kit';
import { TuiButtonModule, TuiGroupModule } from '@taiga-ui/core';
import { TranslateModule } from '@ngx-translate/core';
import { TuiTableModule } from '@taiga-ui/addon-table';
import { TextMaskModule } from "angular2-text-mask";

@NgModule({
  declarations: [
    ZmanimComponent,
    ZmanimFormComponent,
    ZmanimInfoComponent,
    ZmanimConvertFormComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    DefaultLayoutModule,
    ZmanimRoutingModule,
    TuiInputModule,
    TuiInputDateModule,
    TuiInputNumberModule,
    TuiGroupModule,
    TranslateModule,
    TuiTableModule,
    TuiButtonModule,
    TuiIslandModule,
    TextMaskModule,
  ],
})
export class ZmanimModule {}
