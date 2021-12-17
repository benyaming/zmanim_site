import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';
import {HTTP_INTERCEPTORS, HttpClientModule} from '@angular/common/http';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {AppComponent} from './app.component';
import {AppRoutingModule} from './app-routing.module';
import {DOCUMENT} from '@angular/common';
import {FreegeoipInterceptor} from '@core/freegeoip';
import {MAPBOX_API_KEY, NgxMapboxGLModule} from 'ngx-mapbox-gl';
import {MatNativeDateModule} from '@angular/material/core';

function mapboxApiKeyFactory(document: Document): string {
  return document.defaultView.env.mapboxPublicApiKey;
}

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    BrowserAnimationsModule,
    MatNativeDateModule,
    NgxMapboxGLModule,
    AppRoutingModule,
  ],
  providers: [
    {provide: MAPBOX_API_KEY, useFactory: mapboxApiKeyFactory, deps: [DOCUMENT]},
    {provide: HTTP_INTERCEPTORS, useClass: FreegeoipInterceptor, multi: true}
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
