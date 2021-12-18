import { TestBed } from '@angular/core/testing';

import { FreegeoipInterceptor } from './freegeoip.interceptor';

describe('FreegeoipInterceptor', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [
      FreegeoipInterceptor
      ]
  }));

  it('should be created', () => {
    const interceptor: FreegeoipInterceptor = TestBed.inject(FreegeoipInterceptor);
    expect(interceptor).toBeTruthy();
  });
});
