import {AppStateModel} from "./app.models";


export const APP_DEFAULTS: AppStateModel = {
  location: null,
  zmanim: {
    form: {
      date: new Date()
    },
    info: null
  }
}
