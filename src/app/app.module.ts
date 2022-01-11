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
import {
  TranslateLoader,
  TranslateModule,
  TranslateService,
} from '@ngx-translate/core';
import { MapboxInterceptor } from '@core/mapbox';
import { NgxsModule, Store } from '@ngxs/store';
import { environment } from '../environments/environment';
import { NgxsReduxDevtoolsPluginModule } from '@ngxs/devtools-plugin';
import {
  AppState,
  AppStateModel,
  SetLocationFromGeoip,
  SetLocationFromNavigator,
} from '@core/state';
import { DOCUMENT } from '@angular/common';
import { TUI_LANGUAGE } from '@taiga-ui/i18n';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { Language } from '@taiga-ui/i18n/interfaces';

function translateLoaderFactory(http: HttpClient): TranslateLoader {
  return new TranslateHttpLoader(http);
}

function appInitializerFactory(
  store: Store,
  translateService: TranslateService,
  title: Title,
  document: Document,
): () => Observable<any> {
  return () => {
    store.dispatch([
      new SetLocationFromNavigator(),
      new SetLocationFromGeoip(),
    ]);

    const {
      browserTabTitle,
      currentLanguage,
      supportedLanguages,
    }: AppStateModel = store.selectSnapshot(AppState);

    translateService.langs = supportedLanguages.map(({ name }) => name);
    translateService.setDefaultLang(currentLanguage.name);

    document.documentElement.dir = currentLanguage.direction;
    document.documentElement.lang = currentLanguage.name;

    return translateService
      .get(browserTabTitle)
      .pipe(tap((translated) => title.setTitle(translated)));
  };
}

function tuiLanguageFactory(store: Store): Observable<Language> {
  return store
    .select(AppState.currentLanguage)
    .pipe(map(({ tuiLanguage }) => tuiLanguage));
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    HttpClientModule,
    BrowserAnimationsModule,
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
      deps: [Store, TranslateService, Title, DOCUMENT],
      multi: true,
    },
    {
      provide: TUI_LANGUAGE,
      useFactory: tuiLanguageFactory,
      deps: [Store],
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
