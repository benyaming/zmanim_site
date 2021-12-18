import {Inject, Injectable} from '@angular/core';
import {HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {Observable} from 'rxjs';
import {FreegeoipService} from './freegeoip.service';
import {DOCUMENT} from '@angular/common';
import {FreegeoipQueryParams} from './freegeoip.query-params';

@Injectable()
export class FreegeoipInterceptor implements HttpInterceptor {

  constructor(
    private readonly freegeoipService: FreegeoipService,
    @Inject(DOCUMENT) private readonly document: Document
  ) {
  }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!request.url.startsWith(this.freegeoipService.urlPrefix)) {
      return next.handle(request);
    }

    const params: FreegeoipQueryParams = {
      apikey: this.document.defaultView.env.freegeoipApiKey
    };
    return next.handle(request.clone({setParams: params}));
  }
}
