import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ConverterRoutingModule } from './converter-routing.module';
import { ConverterComponent } from './converter.component';
import { ReactiveFormsModule } from '@angular/forms';
import { TuiInputModule } from '@taiga-ui/kit';
import { TextMaskModule } from 'angular2-text-mask';
import { TranslateModule } from '@ngx-translate/core';
import { TuiButtonModule, TuiLabelModule } from '@taiga-ui/core';

@NgModule({
  declarations: [ConverterComponent],
  imports: [
    CommonModule,
    ConverterRoutingModule,
    ReactiveFormsModule,
    TuiInputModule,
    TextMaskModule,
    TranslateModule,
    TuiButtonModule,
    TuiLabelModule,
  ],
})
export class ConverterModule {}
