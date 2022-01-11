import { AppStateModel } from './app.models';

export const APP_DEFAULTS: AppStateModel = {
  browserTabTitle: 'app.browser-tab-title',
  currentLanguage: {
    name: 'en',
    direction: 'ltr',
    country: 'us',
  },
  supportedLanguages: [
    {
      name: 'en',
      direction: 'ltr',
      country: 'us',
    },
    {
      name: 'he',
      direction: 'rtl',
      country: 'il',
    },
    {
      name: 'ru',
      direction: 'ltr',
      country: 'ru',
    },
  ],
  location: null,
  zmanim: {
    form: {
      date: new Date(),
    },
    info: null,
  },
};
