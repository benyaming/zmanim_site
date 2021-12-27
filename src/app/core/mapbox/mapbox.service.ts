import {Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {PlacesRouteParams} from './places.route-params';
import {PlacesQueryParams} from './places.query-params';
import {PlacesResponseDto} from './places.response-dto';

@Injectable({
  providedIn: 'root'
})
export class MapboxService {
  readonly urlPrefix = 'https://api.mapbox.com/geocoding/v5/';

  constructor(
    private readonly http: HttpClient
  ) {
  }

  places(routeParams: PlacesRouteParams, queryParams: PlacesQueryParams): Observable<PlacesResponseDto> {
    const url = `${this.urlPrefix}mapbox.places/${routeParams.lng},${routeParams.lat}.json`;

    return this.http.get<PlacesResponseDto>(url, {params: queryParams});
  }
}
