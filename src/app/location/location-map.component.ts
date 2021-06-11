import {Component, OnInit} from '@angular/core';
import {Marker} from './marker.type';


@Component({
  selector: 'app-location-map',
  templateUrl: './location-map.component.html',
  styleUrls: ['./location-map.component.css']
})
export class LocationMapComponent implements OnInit {

  // google maps zoom level
  zoom = 8;

  marker: Marker = {
    lat: 55.5,
    lng: 37.7,
    draggable: true
  };

  constructor() {}

  ngOnInit(): void {}

  mapClicked($event: any): void {
    this.marker = {
      lat: $event.coords.lat,
      lng: $event.coords.lng,
      draggable: true
    };
  }
}
