import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import mapboxgl, { EventData, Map, MapMouseEvent, Marker } from 'mapbox-gl';
import { Observable, Subscription } from 'rxjs';
import { MapboxService } from '@core/mapbox';
import { AppState, LocationModel, SetLocationManually } from '@core/state';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { filter, map, shareReplay } from 'rxjs/operators';
import { Select, Store } from '@ngxs/store';
import MapboxGeocoder, { Result } from '@mapbox/mapbox-gl-geocoder';
// @ts-ignore
import MapboxLanguage from '@mapbox/mapbox-gl-language';

@Component({
  selector: 'app-default-layout-map',
  templateUrl: './default-layout-map.component.html',
  styleUrls: ['./default-layout-map.component.scss'],
})
export class DefaultLayoutMapComponent implements AfterViewInit, OnDestroy {
  @Select(AppState.location)
  private readonly location$!: Observable<LocationModel | null>;

  readonly isHandset$: Observable<boolean> = this.breakpointObserver
    .observe(Breakpoints.Handset)
    .pipe(
      map((result) => result.matches),
      shareReplay(),
    );

  private map?: Map;
  private marker?: Marker;
  private language?: MapboxLanguage;
  private geocoder?: MapboxGeocoder;
  // private geolocate?: GeolocateControl;

  private readonly onDestroy$: Subscription = new Subscription();

  constructor(
    private readonly mapboxService: MapboxService,
    private readonly breakpointObserver: BreakpointObserver,
    private readonly store: Store,
  ) {}

  ngAfterViewInit(): void {
    this.subForLocationChange();
  }

  ngOnDestroy(): void {
    this.onDestroy$.unsubscribe();
  }

  private subForLocationChange() {
    this.onDestroy$.add(
      this.location$
        .pipe(
          filter((location) => !!location),
          map((location) => location as LocationModel),
        )
        .subscribe((location) => {
          this.map ? this.updateMarker(location) : this.initMap(location);
        }),
    );
  }

  private initMap(location: LocationModel): void {
    const language = this.store.selectSnapshot<string>(
      AppState.currentLanguage,
    );
    mapboxgl.accessToken = window.env.mapboxPublicApiKey;

    this.map = new Map({
      container: 'map',
      center: location,
      zoom: 13,
      style: 'mapbox://styles/mapbox/streets-v11',
    });

    this.marker = new Marker().setLngLat(location).addTo(this.map);

    this.language = new MapboxLanguage({ defaultLanguage: language });

    this.geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: this.map,
      language,
    });

    // this.geolocate = new GeolocateControl({
    //   positionOptions: {
    //     enableHighAccuracy: true,
    //   },
    //   showUserLocation: false,
    //   showAccuracyCircle: false,
    // });

    this.map.addControl(this.language);
    this.map.addControl(this.geocoder);
    // this.map.addControl(this.geolocate);

    this.map.on('click', ($event) => this.onMapClicked($event));
    this.geocoder.on('result', ($event) => this.onGeocoderResulted($event));
    // this.geolocate.on('geolocate', ($event) => this.onGeolocateGeolocated($event));
  }

  private updateMarker(location: LocationModel): void {
    this.marker?.setLngLat(location);
  }

  private onMapClicked({ lngLat }: MapMouseEvent & EventData): void {
    this.onDestroy$.add(
      this.mapboxService.places(lngLat, { limit: '1' }).subscribe((res) => {
        const place: Result = res.features[0];
        if (!place) {
          console.error(
            `received no places for given coords from map click: lat [${lngLat.lat}], lng [${lngLat.lng}]`,
          );
          return;
        }

        const city = place.context.find(({ id }) => id.startsWith('place'));
        this.store.dispatch(
          new SetLocationManually({
            ...lngLat,
            cityName: city?.text ?? place.text,
          }),
        );
      }),
    );
  }

  private onGeocoderResulted({ result }: { result: Result }): void {
    const city = result.context.find(({ id }) => id.startsWith('place'));

    this.store.dispatch(
      new SetLocationManually({
        lat: result.center[1],
        lng: result.center[0],
        cityName: city?.text ?? result.text,
      }),
    );
  }

  // private onGeolocateGeolocated($event?: object): void {
  //   console.log($event);
  // }
}
