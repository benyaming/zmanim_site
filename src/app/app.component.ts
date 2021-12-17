import {Component, Inject, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from 'rxjs';
import {StoreService} from '@core/store';
import {filter} from 'rxjs/operators';
import {DOCUMENT} from '@angular/common';
import {FreegeoipService} from '@core/freegeoip';
import {EventData, LngLatLike, MapMouseEvent} from 'mapbox-gl';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  zoom?: number;
  mapCoords?: LngLatLike;
  markerCoords?: LngLatLike;

  private readonly sub$: Subscription = new Subscription();

  constructor(
    @Inject(DOCUMENT) private readonly document: Document,
    private readonly storeService: StoreService,
    private readonly freegeoipService: FreegeoipService
  ) {
  }

  ngOnInit(): void {
    this.initMap();
    this.initCoordsFromNavigator();
    this.initCoordsFromGeoip();
  }

  ngOnDestroy(): void {
    this.sub$.unsubscribe();
  }

  onMapClicked({lngLat}: MapMouseEvent & EventData): void {
    this.storeService.setCoords({...lngLat, source: 'map'});
  }

  private initMap(): void {
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
    });
  }

  private initCoordsFromNavigator(): void {
    this.document.defaultView.navigator.geolocation
      .getCurrentPosition(({coords}) => {
        this.storeService.setCoords({lat: coords.latitude, lng: coords.longitude, source: 'navigator'});
      });
  }

  private initCoordsFromGeoip(): void {
    this.sub$.add(
      this.freegeoipService.fetchMyGeo()
        .subscribe(({latitude, longitude}) => {
          this.storeService.setCoords({lat: latitude, lng: longitude, source: 'geoip'});
        })
    );
  }
}
