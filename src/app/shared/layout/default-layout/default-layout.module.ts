import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {DefaultLayoutComponent} from './default-layout.component';
import {MatButtonModule} from '@angular/material/button';
import {DefaultLayoutFormDirective} from './default-layout-form.directive';
import {DefaultLayoutInfoDirective} from './default-layout-info.directive';
import {MatCardModule} from '@angular/material/card';


@NgModule({
  declarations: [
    DefaultLayoutComponent,
    DefaultLayoutFormDirective,
    DefaultLayoutInfoDirective
  ],
  exports: [
    DefaultLayoutComponent,
    DefaultLayoutFormDirective,
    DefaultLayoutInfoDirective
  ],
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule
  ]
})
export class DefaultLayoutModule {
}
