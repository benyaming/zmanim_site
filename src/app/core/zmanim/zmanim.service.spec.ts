import {TestBed} from '@angular/core/testing';

import {ZmanimService} from './zmanim.service';

describe('ZmanimService', () => {
  let service: ZmanimService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ZmanimService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
