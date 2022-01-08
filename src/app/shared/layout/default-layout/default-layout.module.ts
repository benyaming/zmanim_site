import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {DefaultLayoutComponent} from './default-layout.component';
import {DefaultLayoutFormDirective} from './default-layout-form/default-layout-form.directive';
import {DefaultLayoutInfoDirective} from './default-layout-info/default-layout-info.directive';
import {TuiIslandModule} from '@taiga-ui/kit';
import {TranslateModule} from '@ngx-translate/core';
import {TuiButtonModule, TuiSvgModule} from '@taiga-ui/core';
import {DefaultLayoutMapComponent} from './default-layout-map/default-layout-map.component';
import {NgxMapboxGLModule} from 'ngx-mapbox-gl';
import {NgxMapboxGlGeocoderControlModule} from "ngx-mapbox-gl-geocoder-control";


@NgModule({
  declarations: [
    DefaultLayoutComponent,
    DefaultLayoutFormDirective,
    DefaultLayoutInfoDirective,
    DefaultLayoutMapComponent
  ],
  exports: [
    DefaultLayoutComponent,
    DefaultLayoutFormDirective,
    DefaultLayoutInfoDirective,
    DefaultLayoutMapComponent
  ],
  imports: [
    CommonModule,
    TuiIslandModule,
    TranslateModule,
    TuiButtonModule,
    TuiSvgModule,
    NgxMapboxGLModule,
    NgxMapboxGlGeocoderControlModule
  ]
})
export class DefaultLayoutModule {
}
