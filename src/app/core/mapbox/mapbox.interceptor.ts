import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { MapboxService } from './mapbox.service';

@Injectable()
export class MapboxInterceptor implements HttpInterceptor {
  constructor(private readonly mapboxService: MapboxService) {}

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    if (!request.url.startsWith(this.mapboxService.urlPrefix)) {
      return next.handle(request);
    }

    const params = {
      access_token: window.env.mapboxPublicApiKey,
    };
    return next.handle(request.clone({ setParams: params }));
  }
}
