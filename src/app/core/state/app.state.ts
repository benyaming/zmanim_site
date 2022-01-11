import { Injectable } from '@angular/core';
import { Action, Selector, State, StateContext } from '@ngxs/store';
import { AppStateModel, LocationModel, ZmanimStateModel } from './app.models';
import { APP_DEFAULTS } from './app.defaults';
import {
  ChangeBrowserTabTitle,
  ChangeCurrentLanguage,
  FetchZmanim,
  SetLocationFromGeoip,
  SetLocationFromNavigator,
  SetLocationManually,
} from './app.actions';
import { MapboxService } from '@core/mapbox';
import { Observable, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { Result } from '@mapbox/mapbox-gl-geocoder';
import { FreegeoipService } from '@core/freegeoip';
import { ZmanimZmanimQueryParams, ZmanimService } from '@core/zmanim';
import { format } from 'date-fns';
import { TranslateService } from '@ngx-translate/core';
import { Title } from '@angular/platform-browser';

@State<AppStateModel>({
  name: 'app',
  defaults: APP_DEFAULTS,
})
@Injectable()
export class AppState {
  @Selector()
  static location(state: AppStateModel): LocationModel | null {
    return state.location;
  }

  @Selector()
  static currentLanguage(state: AppStateModel): string {
    return state.currentLanguage;
  }

  @Selector()
  static supportedLanguages(state: AppStateModel): string[] {
    return state.supportedLanguages;
  }

  @Selector()
  static zmanim(state: AppStateModel): ZmanimStateModel {
    return state.zmanim;
  }

  constructor(
    private readonly mapboxService: MapboxService,
    private readonly freegeoipService: FreegeoipService,
    private readonly zmanimService: ZmanimService,
    private readonly translateService: TranslateService,
    private readonly title: Title,
  ) {}

  @Action(ChangeBrowserTabTitle)
  private changeBrowserTabTitle(
    ctx: StateContext<AppStateModel>,
    { browserTabTitle }: ChangeBrowserTabTitle,
  ): Observable<any> {
    return this.translateService.get(browserTabTitle).pipe(
      tap((translated) => ctx.patchState({ browserTabTitle: translated })),
      tap((translated) => this.title.setTitle(translated)),
    );
  }

  @Action(ChangeCurrentLanguage)
  private changeCurrentLanguage(
    ctx: StateContext<AppStateModel>,
    { currentLanguage }: ChangeCurrentLanguage,
  ): Observable<any> {
    const { supportedLanguages, location } = ctx.getState();
    if (!supportedLanguages.includes(currentLanguage)) {
      const supportedLanguagesString = supportedLanguages.join(', ');
      throw new Error(
        `Can't change language, since [${currentLanguage}] is not in supported languages list [${supportedLanguagesString}]`,
      );
    }

    return this.translateService.use(currentLanguage).pipe(
      tap(() => localStorage.setItem('language', currentLanguage)),
      tap(() => ctx.patchState({ currentLanguage: currentLanguage })),
      switchMap(() => {
        if (!location) {
          return of();
        }

        return this.getFullLocation(location, location.source).pipe(
          tap(({ cityName }) =>
            ctx.patchState({ location: { ...location, cityName } }),
          ),
        );
      }),
    );
  }

  @Action(SetLocationFromNavigator)
  private setLocationFromNavigator(
    ctx: StateContext<AppStateModel>,
  ): Observable<any> {
    return new Observable<GeolocationPosition>((observer) => {
      navigator.geolocation.getCurrentPosition(
        (success) => {
          observer.next(success);
          observer.complete();
        },
        (error) => {
          observer.error(error);
        },
      );
    }).pipe(
      map(({ coords }) => ({ lat: coords.latitude, lng: coords.longitude })),
      switchMap((coords) => this.getFullLocation(coords, 'navigator')),
      tap((location) => this.setLocation(ctx, location)),
    );
  }

  @Action(SetLocationFromGeoip)
  private setLocationFromGeoip(
    ctx: StateContext<AppStateModel>,
  ): Observable<any> {
    return this.freegeoipService.fetch().pipe(
      map(({ latitude, longitude }) => ({ lat: latitude, lng: longitude })),
      switchMap((coords) => this.getFullLocation(coords, 'geoip')),
      tap((location) => this.setLocation(ctx, location)),
    );
  }

  @Action(SetLocationManually)
  private setLocationManually(
    ctx: StateContext<AppStateModel>,
    { location }: SetLocationManually,
  ): void {
    this.setLocation(ctx, { ...location, source: 'manual' });
  }

  @Action(FetchZmanim)
  private fetchZmanim(
    ctx: StateContext<AppStateModel>,
    { form }: FetchZmanim,
  ): Observable<any> {
    const current: LocationModel | null = ctx.getState().location;
    if (!current) {
      throw new Error(
        `You are trying to fetch zmanim when there is no location in the store`,
      );
    }

    const query: ZmanimZmanimQueryParams = {
      date: format(form.date, 'yyyy-MM-dd'),
      lat: current.lat.toString(),
      lng: current.lng.toString(),
    };

    return this.zmanimService.fetchZmanim(query).pipe(
      tap(({ settings, ...info }) => {
        ctx.patchState({
          zmanim: { form, info },
        });
      }),
    );
  }

  private getFullLocation(
    coords: { lat: number; lng: number },
    source: LocationModel['source'],
  ): Observable<LocationModel> {
    return of(coords).pipe(
      switchMap(({ lat, lng }) =>
        this.mapboxService.places({ lat, lng }, { limit: '1' }),
      ),
      map((res) => {
        const place: Result = res.features[0];
        if (!place) {
          throw new Error(
            `received no places for given coords: lat [${res.query[1]}], lng [${res.query[0]}]`,
          );
        }

        const city = place.context.find(({ id }) => id.startsWith('place'));

        return {
          lat: res.query[1],
          lng: res.query[0],
          cityName: city?.text ?? place.text,
          source,
        };
      }),
    );
  }

  private setLocation(
    ctx: StateContext<AppStateModel>,
    location: LocationModel,
  ): void {
    const current: LocationModel | null = ctx.getState().location;
    if (!current) {
      ctx.patchState({ location });
      return;
    }

    switch (location.source) {
      case 'manual':
        ctx.patchState({ location });
        break;
      case 'navigator':
        if (current.source !== 'manual') {
          ctx.patchState({ location });
        }
        break;
      case 'geoip':
        if (current.source !== 'manual' && current.source !== 'navigator') {
          ctx.patchState({ location });
        }
        break;
    }
  }
}
