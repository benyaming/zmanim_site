import { Injectable } from '@angular/core';
import { Store } from '@ngxs/store';
import { TranslateLoader, TranslateService } from '@ngx-translate/core';
import { Title } from '@angular/platform-browser';
import { Observable } from 'rxjs';
import {
  AppState,
  AppStateModel,
  FetchLocationFromFreegeoip,
  FetchLocationFromNavigator,
} from '@core/state';
import { tap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { NumberFormatSettings } from '@taiga-ui/core/interfaces/number-format-settings';

@Injectable({
  providedIn: 'root',
})
export class AppService {
  readonly tuiNumberFormat: Partial<NumberFormatSettings> = {
    decimalSeparator: '.',
  };

  initApp(
    store: Store,
    translateService: TranslateService,
    title: Title,
  ): () => Observable<any> {
    return () => {
      store.dispatch([
        new FetchLocationFromNavigator(),
        new FetchLocationFromFreegeoip(),
      ]);

      const { browserTabTitle, language }: AppStateModel =
        store.selectSnapshot(AppState);

      translateService.setDefaultLang(language);

      return translateService
        .get(browserTabTitle)
        .pipe(tap((translated) => title.setTitle(translated)));
    };
  }

  getTranslateLoader(http: HttpClient): TranslateLoader {
    return new TranslateHttpLoader(http);
  }
}
