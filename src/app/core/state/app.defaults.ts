import { AppStateModel } from './app.models';
import { TUI_ENGLISH_LANGUAGE, TUI_RUSSIAN_LANGUAGE } from '@taiga-ui/i18n';
import { startOfMonth } from 'date-fns';

export const APP_DEFAULTS: AppStateModel = {
  browserTabTitle: 'app.browser-tab-title',
  currentLanguage: {
    name: 'en',
    direction: 'ltr',
    country: 'us',
    tuiLanguage: TUI_ENGLISH_LANGUAGE,
  },
  supportedLanguages: [
    {
      name: 'en',
      direction: 'ltr',
      country: 'us',
      tuiLanguage: TUI_ENGLISH_LANGUAGE,
    },
    {
      name: 'he',
      direction: 'rtl',
      country: 'il',
      tuiLanguage: TUI_ENGLISH_LANGUAGE,
    },
    {
      name: 'ru',
      direction: 'ltr',
      country: 'ru',
      tuiLanguage: TUI_RUSSIAN_LANGUAGE,
    },
  ],
  location: null,
  zmanim: {
    form: {
      date: new Date(),
    },
    info: null,
  },
  calendar: {
    displayedPeriodDate: startOfMonth(new Date()),
    selectedDayDate: null,
  },
};
