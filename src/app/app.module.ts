import {NgDompurifySanitizer} from '@tinkoff/ng-dompurify';
import {TUI_SANITIZER, TuiDialogModule, TuiNotificationsModule, TuiRootModule} from '@taiga-ui/core';
import {BrowserModule} from '@angular/platform-browser';
import {NgModule} from '@angular/core';
import {HTTP_INTERCEPTORS, HttpClient, HttpClientModule} from '@angular/common/http';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {AppComponent} from './app.component';
import {AppRoutingModule} from './app-routing.module';
import {DOCUMENT} from '@angular/common';
import {FreegeoipInterceptor} from '@core/freegeoip';
import {MAPBOX_API_KEY, NgxMapboxGLModule} from 'ngx-mapbox-gl';
import {TranslateLoader, TranslateModule} from '@ngx-translate/core';
import {TranslateHttpLoader} from '@ngx-translate/http-loader';

function mapboxApiKeyFactory(document: Document): string {
  return document.defaultView.env.mapboxPublicApiKey;
}

export function translateLoaderFactory(http: HttpClient): TranslateLoader {
  return new TranslateHttpLoader(http);
}

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    BrowserAnimationsModule,
    NgxMapboxGLModule,
    AppRoutingModule,
    TuiRootModule,
    TuiDialogModule,
    TuiNotificationsModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: translateLoaderFactory,
        deps: [HttpClient]
      },
      useDefaultLang: true,
      defaultLanguage: 'en',
    })
  ],
  providers: [
    {provide: MAPBOX_API_KEY, useFactory: mapboxApiKeyFactory, deps: [DOCUMENT]},
    {provide: HTTP_INTERCEPTORS, useClass: FreegeoipInterceptor, multi: true},
    {provide: TUI_SANITIZER, useClass: NgDompurifySanitizer}
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
