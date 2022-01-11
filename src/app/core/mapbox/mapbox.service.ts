import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MapboxPlacesRouteParams } from './mapbox.route-params';
import { MapboxPlacesQueryParams } from './mapbox.query-params';
import { MapboxPlacesResponseDto } from './mapbox.dtos';

@Injectable({
  providedIn: 'root',
})
export class MapboxService {
  readonly urlPrefix = 'https://api.mapbox.com/geocoding/v5/';

  constructor(private readonly http: HttpClient) {}

  places(
    routeParams: MapboxPlacesRouteParams,
    queryParams: MapboxPlacesQueryParams,
  ): Observable<MapboxPlacesResponseDto> {
    const url = `${this.urlPrefix}mapbox.places/${routeParams.lng},${routeParams.lat}.json`;

    return this.http.get<MapboxPlacesResponseDto>(url, { params: queryParams });
  }
}
