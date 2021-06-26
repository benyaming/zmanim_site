import { TestBed } from '@angular/core/testing';

import { ZmanimApiService } from './zmanim-api.service';

describe('ZmanimService', () => {
  let service: ZmanimApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ZmanimApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
