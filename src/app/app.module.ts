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
import { AppState } from '@core/state';
import { AppService } from './app.service';

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
        useFactory: (http: HttpClient) => AppService.getTranslateLoader(http),
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
      useFactory: (
        store: Store,
        translateService: TranslateService,
        title: Title,
      ) => AppService.initApp(store, translateService, title),
      deps: [Store, TranslateService, Title],
      multi: true,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
