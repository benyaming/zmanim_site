import {Component, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from 'rxjs';
import {StoreService} from '@core/store';
import {FreegeoipService} from '@core/freegeoip';
import {Result} from '@mapbox/mapbox-gl-geocoder';
import {MapboxService} from '@core/mapbox';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {

  private readonly onDestroy$: Subscription = new Subscription();

  constructor(
    private readonly storeService: StoreService,
    private readonly freegeoipService: FreegeoipService,
    private readonly mapboxService: MapboxService
  ) {
  }

  ngOnInit(): void {
    this.initCoordsFromNavigator();
    this.initCoordsFromGeoip();
  }

  ngOnDestroy(): void {
    this.onDestroy$.unsubscribe();
  }

  private initCoordsFromNavigator(): void {
    window.navigator.geolocation
      .getCurrentPosition(({coords}) => {
        this.onDestroy$.add(
          this.mapboxService.places({lat: coords.latitude, lng: coords.longitude}, {limit: '1'})
            .subscribe(res => {
              const place: Result = res.features[0];
              if (!place) {
                console.warn(`received no places for given coords from navigator: lat [${coords.latitude}], lng [${coords.longitude}]`);
                return;
              }

              const city = place.context.find(({id}) => id.startsWith('place'));

              this.storeService.setCoords({
                lat: coords.latitude,
                lng: coords.longitude,
                cityName: city?.text ?? place.text,
                source: 'navigator'
              });
            })
        );
      });
  }

  private initCoordsFromGeoip(): void {
    this.onDestroy$.add(
      this.freegeoipService.fetchMyGeo()
        .subscribe(({latitude, longitude, city}) => {
          this.storeService.setCoords({
            lat: latitude,
            lng: longitude,
            cityName: city,
            source: 'geoip'
          });
        })
    );
  }
}
