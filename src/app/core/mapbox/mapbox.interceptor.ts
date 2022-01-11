import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { MapboxService } from './mapbox.service';
import { Store } from '@ngxs/store';
import { AppState, AppStateModel } from '@core/state';

@Injectable()
export class MapboxInterceptor implements HttpInterceptor {
  constructor(
    private readonly mapboxService: MapboxService,
    private readonly store: Store,
  ) {}

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    if (!request.url.startsWith(this.mapboxService.urlPrefix)) {
      return next.handle(request);
    }

    const { language }: AppStateModel = this.store.selectSnapshot(AppState);

    const params = {
      access_token: window.env.mapboxPublicApiKey,
      language,
    };
    return next.handle(request.clone({ setParams: params }));
  }
}
