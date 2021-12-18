import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {FreegeoipResponseDto} from './freegeoip.response-dto';

@Injectable({
  providedIn: 'root'
})
export class FreegeoipService {
  // NOTE: We have to use here absolute path and not just prefix like in ZmanimService,
  // because if we proxy request by ng dev server or nginx
  // then freegeoip will get IP of the server and not of the client machine, and it is wrong
  // TODO Check that there is no CORS problems and if so we have two options:
  //  1) To proxy this stuff via nginx, but then we need to use not "own IP" endpoint,
  //  but retrieve the current IP with JS from the browser manually and proxy it to "specific IP" endpoint
  //  2) To configure nginx to set http-header that tells the browser to allow CORS with https://api.freegeoip.app/
  readonly urlPrefix = 'https://api.freegeoip.app/';

  constructor(
    private readonly http: HttpClient
  ) {
  }

  fetchMyGeo(): Observable<FreegeoipResponseDto> {
    return this.http.get<FreegeoipResponseDto>(`${this.urlPrefix}json`);
  }
}
