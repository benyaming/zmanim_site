import {Component, Inject, OnDestroy} from '@angular/core';
import {EventData, MapMouseEvent} from 'mapbox-gl';
import {Result} from '@mapbox/mapbox-gl-geocoder';
import {Subscription} from 'rxjs';
import {MapboxService} from '@core/mapbox';
import {POLYMORPHEUS_CONTEXT} from '@tinkoff/ng-polymorpheus';
import {TuiDialogContext} from '@taiga-ui/core';
import {LocationModel, LocationWithoutSourceModel} from "@core/state";

// For some reason when mapbox is used inside a tui dialog and markerCoords is changed asynchronously
// (e.g. it is updated via subscription a store or updated inside mapbox.places subscribe callback)
// it bugs in the following way:
//   first map click changes store, but not marker on the map
//   second map click also changes store, but now map shows marker at position after the first click
//   third click - marker will be at second click and so on
// Therefore this component receives and returns data via dialog context interface and not via store
// and also it updates marker position in onMapClicked method before it gets response from mapboxService
@Component({
  selector: 'app-default-layout-map',
  templateUrl: './default-layout-map.component.html',
  styleUrls: ['./default-layout-map.component.scss']
})
export class DefaultLayoutMapComponent implements OnDestroy {
  mapCoords: { lng: number; lat: number } = this.context.data;
  markerCoords: { lng: number; lat: number } = this.mapCoords;

  private cityName: string | null = this.context.data.cityName;

  private readonly onDestroy$: Subscription = new Subscription();

  constructor(
    private readonly mapboxService: MapboxService,
    @Inject(POLYMORPHEUS_CONTEXT) private readonly context: TuiDialogContext<LocationWithoutSourceModel, LocationWithoutSourceModel>,
  ) {
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

  onGeocoderResulted({result}: { result: Result }): void {
    const city = result.context.find(({id}) => id.startsWith('place'));

    this.markerCoords = {
      lat: result.center[1],
      lng: result.center[0]
    };
    this.cityName = city?.text ?? result.text;
  }

  onSubmitClicked(): void {
    this.context.completeWith({...this.markerCoords, cityName: this.cityName})
  }
}
