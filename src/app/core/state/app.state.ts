import { Injectable } from '@angular/core';
import { Action, Selector, State, StateContext } from '@ngxs/store';
import { AppStateModel, LocationModel, ZmanimStateModel } from './app.models';
import { APP_DEFAULTS } from './app.defaults';
import {
  ChangeBrowserTabTitle,
  FetchLocationFromFreegeoip,
  FetchLocationFromNavigator,
  FetchZmanim,
  SetLocationManually,
} from './app.actions';
import { MapboxService } from '@core/mapbox';
import { Observable } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { Result } from '@mapbox/mapbox-gl-geocoder';
import { FreegeoipService } from '@core/freegeoip';
import { ZmanimQueryParams, ZmanimService } from '@core/zmanim';
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
  changeBrowserTabTitle(
    ctx: StateContext<AppStateModel>,
    { browserTabTitle }: ChangeBrowserTabTitle,
  ): Observable<any> {
    return this.translateService.get(browserTabTitle).pipe(
      tap((translated) => ctx.patchState({ browserTabTitle: translated })),
      tap((translated) => this.title.setTitle(translated)),
    );
  }

  @Action(FetchLocationFromNavigator)
  fetchLocationFromNavigator(
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
      switchMap((coords) => this.mapboxService.places(coords, { limit: '1' })),
      tap((res) => {
        const place: Result = res.features[0];
        if (!place) {
          console.error(
            `received no places for given coords from navigator: lat [${res.query[1]}], lng [${res.query[0]}]`,
          );
          return;
        }

        const city = place.context.find(({ id }) => id.startsWith('place'));

        this.setLocation(ctx, {
          lat: res.query[1],
          lng: res.query[0],
          cityName: city?.text ?? place.text,
          source: 'navigator',
        });
      }),
    );
  }

  @Action(FetchLocationFromFreegeoip)
  fetchLocationFromFreegeoip(
    ctx: StateContext<AppStateModel>,
  ): Observable<any> {
    return this.freegeoipService.fetchMyGeo().pipe(
      tap(({ latitude, longitude, city }) => {
        this.setLocation(ctx, {
          lat: latitude,
          lng: longitude,
          cityName: city,
          source: 'geoip',
        });
      }),
    );
  }

  @Action(SetLocationManually)
  setLocationManually(
    ctx: StateContext<AppStateModel>,
    { location }: SetLocationManually,
  ): void {
    this.setLocation(ctx, { ...location, source: 'manual' });
  }

  @Action(FetchZmanim)
  fetchZmanim(
    ctx: StateContext<AppStateModel>,
    { form }: FetchZmanim,
  ): Observable<any> | undefined {
    const location: LocationModel | null = ctx.getState().location;
    if (!location) {
      return;
    }

    const query: ZmanimQueryParams = {
      date: format(form.date, 'yyyy-MM-dd'),
      lat: location.lat.toString(),
      lng: location.lng.toString(),
    };

    return this.zmanimService.fetchZmanim(query).pipe(
      tap(({ settings, ...info }) => {
        ctx.patchState({
          zmanim: { form, info },
        });
      }),
    );
  }

  private setLocation(
    ctx: StateContext<AppStateModel>,
    location: LocationModel,
  ): void {
    const current: LocationModel | null = ctx.getState().location;
    if (!location) {
      return;
    }

    switch (location.source) {
      case 'manual':
        ctx.patchState({ location });
        break;
      case 'navigator':
        if (current?.source !== 'manual') {
          ctx.patchState({ location });
        }
        break;
      case 'geoip':
        if (current?.source !== 'manual' && current?.source !== 'navigator') {
          ctx.patchState({ location });
        }
        break;
    }
  }
}
