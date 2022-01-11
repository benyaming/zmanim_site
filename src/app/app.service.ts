import { Injectable } from '@angular/core';
import { Store } from '@ngxs/store';
import { TranslateLoader, TranslateService } from '@ngx-translate/core';
import { Title } from '@angular/platform-browser';
import { Observable } from 'rxjs';
import {
  AppState,
  AppStateModel,
  SetLocationFromGeoip,
  SetLocationFromNavigator,
} from '@core/state';
import { tap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

@Injectable({
  providedIn: 'root',
})
export class AppService {
  static initApp(
    store: Store,
    translateService: TranslateService,
    title: Title,
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

      translateService.langs = supportedLanguages;
      translateService.setDefaultLang(currentLanguage);

      return translateService
        .get(browserTabTitle)
        .pipe(tap((translated) => title.setTitle(translated)));
    };
  }

  static getTranslateLoader(http: HttpClient): TranslateLoader {
    return new TranslateHttpLoader(http);
  }
}
