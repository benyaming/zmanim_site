import { TestBed } from '@angular/core/testing';

import { MapboxInterceptor } from './mapbox.interceptor';

describe('MapboxInterceptor', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [MapboxInterceptor],
    }),
  );

  it('should be created', () => {
    const interceptor: MapboxInterceptor = TestBed.inject(MapboxInterceptor);
    expect(interceptor).toBeTruthy();
  });
});
