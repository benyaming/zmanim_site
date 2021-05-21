import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';

import {AppComponent} from './app.component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {HttpClientModule} from '@angular/common/http';
import {MatRadioModule} from '@angular/material/radio';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {DateAdapter, MatNativeDateModule} from '@angular/material/core';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {AgmCoreModule} from '@agm/core';
// import {} from 'googlemaps';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    ReactiveFormsModule,
    MatRadioModule,
    MatDatepickerModule,
    MatNativeDateModule,
    BrowserAnimationsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonToggleModule,
    // NgxMapboxGLModule.withConfig({
    //   accessToken: 'pk.eyJ1IjoiYmVueWFtaW5nIiwiYSI6ImNrbGUwemk5ODBueWkyeHA3YzdhNjMzMGsifQ.Kh2Zg8ob0KjLGmFXR8jluA',
    // })
    AgmCoreModule.forRoot({
      apiKey: 'pk.eyJ1IjoiYmVueWFtaW5nIiwiYSI6ImNrbGUwemk5ODBueWkyeHA3YzdhNjMzMGsifQ.Kh2Zg8ob0KjLGmFXR8jluA',
      libraries: ['places']
    })
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
