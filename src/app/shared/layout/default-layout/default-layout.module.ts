import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DefaultLayoutComponent } from './default-layout.component';
import { DefaultLayoutFormDirective } from './default-layout-form/default-layout-form.directive';
import { DefaultLayoutInfoDirective } from './default-layout-info/default-layout-info.directive';
import { TranslateModule } from '@ngx-translate/core';
import {
  TuiButtonModule,
  TuiDataListModule,
  TuiHostedDropdownModule,
  TuiSvgModule,
} from '@taiga-ui/core';
import { DefaultLayoutMapComponent } from './default-layout-map/default-layout-map.component';
import { I18nModule } from '@shared/i18n';

@NgModule({
  declarations: [
    DefaultLayoutComponent,
    DefaultLayoutFormDirective,
    DefaultLayoutInfoDirective,
    DefaultLayoutMapComponent,
  ],
  exports: [
    DefaultLayoutComponent,
    DefaultLayoutFormDirective,
    DefaultLayoutInfoDirective,
    DefaultLayoutMapComponent,
  ],
  imports: [
    CommonModule,
    TranslateModule,
    TuiSvgModule,
    I18nModule,
    TuiButtonModule,
    TuiHostedDropdownModule,
    TuiDataListModule,
  ],
})
export class DefaultLayoutModule {}
