import {Injectable} from '@angular/core';
import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {Observable} from 'rxjs';
import {FreegeoipService} from './freegeoip.service';


@Injectable()
export class FreegeoipInterceptor implements HttpInterceptor {

  constructor(
    private readonly freegeoipService: FreegeoipService,
  ) {
  }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!request.url.startsWith(this.freegeoipService.urlPrefix)) {
      return next.handle(request);
    }

    const params = {
      apikey: window.env.freegeoipApiKey
    };
    return next.handle(request.clone({setParams: params}));
  }
}
