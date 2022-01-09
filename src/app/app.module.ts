import { NgDompurifySanitizer } from '@tinkoff/ng-dompurify';
import {
  TUI_NUMBER_FORMAT,
  TUI_SANITIZER,
  TuiDialogModule,
  TuiNotificationsModule,
  TuiRootModule,
} from '@taiga-ui/core';
import { BrowserModule, Title } from '@angular/platform-browser';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import {
  HTTP_INTERCEPTORS,
  HttpClient,
  HttpClientModule,
} from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { FreegeoipInterceptor } from '@core/freegeoip';
import { NgxMapboxGLModule } from 'ngx-mapbox-gl';
import {
  TranslateLoader,
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { MapboxInterceptor } from '@core/mapbox';
import { NgxsModule, Store } from '@ngxs/store';
import { environment } from '../environments/environment';
import { NgxsReduxDevtoolsPluginModule } from '@ngxs/devtools-plugin';
import {
  AppState,
  FetchLocationFromFreegeoip,
  FetchLocationFromNavigator,
} from '@core/state';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

export function translateLoaderFactory(http: HttpClient): TranslateLoader {
  return new TranslateHttpLoader(http);
}

export function appInitializerFactory(
  store: Store,
  translateService: TranslateService,
  title: Title,
): () => Observable<any> {
  return () => {
    store.dispatch([
      new FetchLocationFromNavigator(),
      new FetchLocationFromFreegeoip(),
    ]);

    const { browserTabTitle } = store.selectSnapshot(AppState);
    return translateService
      .get(browserTabTitle)
      .pipe(tap((translated) => title.setTitle(translated)));
  };
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    BrowserAnimationsModule,
    NgxMapboxGLModule.withConfig({
      accessToken: window.env.mapboxPublicApiKey,
    }),
    AppRoutingModule,
    TuiRootModule,
    TuiDialogModule,
    TuiNotificationsModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: translateLoaderFactory,
        deps: [HttpClient],
      },
      useDefaultLang: true,
      defaultLanguage: 'en',
    }),
    NgxsModule.forRoot([AppState], {
      developmentMode: !environment.production,
    }),
    NgxsReduxDevtoolsPluginModule.forRoot(),
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: FreegeoipInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: MapboxInterceptor, multi: true },
    { provide: TUI_SANITIZER, useClass: NgDompurifySanitizer },
    { provide: TUI_NUMBER_FORMAT, useValue: { decimalSeparator: '.' } },
    {
      provide: APP_INITIALIZER,
      useFactory: appInitializerFactory,
      deps: [Store, TranslateService, Title],
      multi: true,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
