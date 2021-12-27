import {Component, OnDestroy, OnInit} from '@angular/core';
import {EventData, LngLatLike, MapMouseEvent} from 'mapbox-gl';
import {Result} from '@mapbox/mapbox-gl-geocoder';
import {filter} from 'rxjs/operators';
import {StoreService} from '@core/store';
import {Subscription} from 'rxjs';
import {MapboxService} from '@core/mapbox';


@Component({
  selector: 'app-default-layout-map',
  templateUrl: './default-layout-map.component.html',
  styleUrls: ['./default-layout-map.component.scss']
})
export class DefaultLayoutMapComponent implements OnInit, OnDestroy {
  zoom?: number;
  mapCoords?: LngLatLike;
  markerCoords?: LngLatLike;

  private readonly onDestroy$: Subscription = new Subscription();

  constructor(
    private readonly storeService: StoreService,
    private readonly mapboxService: MapboxService
  ) {
  }

  ngOnInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.onDestroy$.unsubscribe();
  }

  onMapClicked({lngLat}: MapMouseEvent & EventData): void {
    this.onDestroy$.add(
      this.mapboxService.places(lngLat, {limit: '1'})
        .subscribe(res => {
          const place: Result = res.features[0];
          if (!place) {
            console.warn(`received no places for given coords from map click: lat [${lngLat.lat}], lng [${lngLat.lng}]`);
            return;
          }

          const city = place.context.find(({id}) => id.startsWith('place'));

          this.storeService.setCoords({
            lat: lngLat.lat,
            lng: lngLat.lng,
            cityName: city?.text ?? place.text,
            source: 'map'
          });
        })
    );
  }

  onGeocoderResult({result}: { result: Result }): void {
    const city = result.context.find(({id}) => id.startsWith('place'));

    this.storeService.setCoords({
      lat: result.center[1],
      lng: result.center[0],
      cityName: city?.text ?? result.text,
      source: 'map'
    });
  }

  private initMap(): void {
    this.onDestroy$.add(
      this.storeService.coords$.pipe(
        filter(({lat, lng, source}) => !!(lat && lng && source)),
      ).subscribe(({lat, lng, source}) => {
        switch (source) {
          case 'navigator':
          case 'geoip':
            this.zoom = 8;
            this.mapCoords = {lat, lng};
            this.markerCoords = {lat, lng};
            break;
          case 'map':
            this.markerCoords = {lat, lng};
            break;
        }
      })
    );
  }
}
