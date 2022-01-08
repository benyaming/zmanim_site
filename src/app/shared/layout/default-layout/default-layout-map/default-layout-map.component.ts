import {Component, Inject, Input, OnDestroy, OnInit, Optional} from '@angular/core';
import {EventData, LngLatLike, MapMouseEvent} from 'mapbox-gl';
import {Result} from '@mapbox/mapbox-gl-geocoder';
import {CoordsModel} from '@core/store';
import {Subscription} from 'rxjs';
import {MapboxService} from '@core/mapbox';
import {POLYMORPHEUS_CONTEXT} from '@tinkoff/ng-polymorpheus';
import {TuiDialogContext} from '@taiga-ui/core';


@Component({
  selector: 'app-default-layout-map',
  templateUrl: './default-layout-map.component.html',
  styleUrls: ['./default-layout-map.component.scss']
})
export class DefaultLayoutMapComponent implements OnInit, OnDestroy {
  zoom = 8;
  @Input() mapCoords: LngLatLike;
  @Input() cityName: string;
  markerCoords: LngLatLike;

  private readonly onDestroy$: Subscription = new Subscription();

  constructor(
    private readonly mapboxService: MapboxService,
    @Optional() @Inject(POLYMORPHEUS_CONTEXT) private readonly context?: TuiDialogContext<CoordsModel, CoordsModel>,
  ) {
  }

  ngOnInit(): void {
    if (this.context) {
      this.mapCoords = {
        lat: this.context.data.lat,
        lng: this.context.data.lng
      };
      this.cityName = this.context.data.cityName;
    }
    this.markerCoords = {
      ...this.mapCoords
    };
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

          this.markerCoords = lngLat;
          this.cityName = city?.text ?? place.text;
        })
    );
  }

  onGeocoderResult({result}: { result: Result }): void {
    const city = result.context.find(({id}) => id.startsWith('place'));

    this.markerCoords = {
      lat: result.center[1],
      lng: result.center[0]
    };
    this.cityName = city?.text ?? result.text;
  }
}
