import {Component, OnDestroy, OnInit} from '@angular/core';
import {ZmanimStore} from '../zmanim.store';
import {Subscription} from 'rxjs';
import {LatLngLiteral, MouseEvent} from '@agm/core/map-types';
import {take} from 'rxjs/operators';


@Component({
  selector: 'app-zmanim-map',
  templateUrl: './zmanim-map.component.html',
  styleUrls: ['./zmanim-map.component.scss']
})
export class ZmanimMapComponent implements OnInit, OnDestroy {
  zoom = 8;

  mapCoords?: LatLngLiteral;
  markerCoords?: LatLngLiteral;

  private readonly sub$: Subscription = new Subscription();

  constructor(
    private readonly store: ZmanimStore,
  ) {
  }

  ngOnInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.sub$.unsubscribe();
  }

  onMapClicked({coords}: MouseEvent): void {
    this.store.setLocation(coords);
  }

  private initMap(): void {
    this.store.params$.pipe(
      take(1)
    ).subscribe(({lat, lng}) => {
      this.mapCoords = {lat, lng};
    });

    this.sub$.add(
      this.store.params$.subscribe(({lat, lng}) => {
        this.markerCoords = {lat, lng};
      })
    );
  }
}
