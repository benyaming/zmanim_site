import {Component, Inject, OnDestroy} from '@angular/core';
import {EventData, MapMouseEvent} from 'mapbox-gl';
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
export class DefaultLayoutMapComponent implements OnDestroy {
  mapCoords: { lng: number; lat: number };
  markerCoords: { lng: number; lat: number };
  cityName: string | null;

  private readonly onDestroy$: Subscription = new Subscription();

  constructor(
    private readonly mapboxService: MapboxService,
    @Inject(POLYMORPHEUS_CONTEXT) private readonly context: TuiDialogContext<CoordsModel, CoordsModel>,
  ) {
    this.mapCoords = this.context.data;
    this.markerCoords = this.mapCoords;
    this.cityName = this.context.data.cityName;
  }

  ngOnDestroy(): void {
    this.onDestroy$.unsubscribe();
  }

  onMapClicked({lngLat}: MapMouseEvent & EventData): void {
    this.markerCoords = lngLat;

    this.onDestroy$.add(
      this.mapboxService.places(lngLat, {limit: '1'})
        .subscribe(res => {
          const place: Result = res.features[0];
          if (!place) {
            console.error(`received no places for given coords from map click: lat [${lngLat.lat}], lng [${lngLat.lng}]`);
            this.cityName = null;
            return;
          }

          const city = place.context.find(({id}) => id.startsWith('place'));

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
