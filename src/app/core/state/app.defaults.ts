import { AppStateModel } from './app.models';

export const APP_DEFAULTS: AppStateModel = {
  browserTabTitle: 'app.browser-tab-title',
  currentLanguage: localStorage.getItem('language') ?? 'en',
  supportedLanguages: ['en', 'he', 'ru'],
  location: null,
  zmanim: {
    form: {
      date: new Date(),
    },
    info: null,
  },
};
