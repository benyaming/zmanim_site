import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ZmanimResponseDto} from './zmanim.response-dto';
import {ZmanimRequestDto} from './zmanim.request-dto';
import {ZmanimQueryParams} from './zmanim.query-params';

// NOTE: In terms of project the word "zmanim" has two meanings: the API itself and one of its endpoints.
// The current service is named after the whole API itself,
// but the method zmanimService.fetchZmanim() and ZmanimModule are named after the endpoint
@Injectable({
  providedIn: 'root'
})
export class ZmanimService {
  readonly urlPrefix = `api/zmanim/`;

  constructor(
    private readonly http: HttpClient
  ) {
  }

  fetchZmanim(dto: ZmanimRequestDto, params: ZmanimQueryParams): Observable<ZmanimResponseDto> {
    return this.http.post<ZmanimResponseDto>(`${this.urlPrefix}zmanim`, dto, {params});
  }
}
