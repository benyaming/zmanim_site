import { Component, HostBinding, OnDestroy, OnInit } from '@angular/core';
import { Select } from '@ngxs/store';
import { AppState } from '@core/state';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  static readonly languageToTextDirectionMap: Record<string, 'ltr' | 'rtl'> = {
    he: 'rtl',
    en: 'ltr',
    ru: 'ltr',
  };

  @Select(AppState.currentLanguage)
  private readonly currentLanguage$!: Observable<string>;

  @HostBinding('dir') private dir = 'ltr';

  private readonly onDestroy$: Subscription = new Subscription();

  ngOnInit(): void {
    this.subForLanguageChange();
  }

  ngOnDestroy(): void {
    this.onDestroy$.unsubscribe();
  }

  private subForLanguageChange(): void {
    this.onDestroy$.add(
      this.currentLanguage$.subscribe((currentLanguage) => {
        if (!AppComponent.languageToTextDirectionMap[currentLanguage]) {
          throw new Error(
            `Can't find text direction for the given language ${currentLanguage}`,
          );
        }

        this.dir = AppComponent.languageToTextDirectionMap[currentLanguage];
      }),
    );
  }
}
