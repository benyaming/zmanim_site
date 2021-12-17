import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';
import {HTTP_INTERCEPTORS, HttpClientModule} from '@angular/common/http';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {AgmCoreModule, LAZY_MAPS_API_CONFIG, LazyMapsAPILoaderConfigLiteral} from '@agm/core';
import {AppComponent} from './app.component';
import {AppRoutingModule} from './app-routing.module';
import {DOCUMENT} from '@angular/common';
import {FreegeoipInterceptor} from '@core/freegeoip';


function lazyMapsApiConfigFactory(document: Document): LazyMapsAPILoaderConfigLiteral {
  return {
    apiKey: document.defaultView?.env.googleApiKey,
    libraries: ['places']
  };
}

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    BrowserAnimationsModule,
    AgmCoreModule.forRoot(),
    AppRoutingModule,
  ],
  providers: [
    {provide: LAZY_MAPS_API_CONFIG, useFactory: lazyMapsApiConfigFactory, deps: [DOCUMENT]},
    {provide: HTTP_INTERCEPTORS, useClass: FreegeoipInterceptor, multi: true}
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
