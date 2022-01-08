import {TestBed} from '@angular/core/testing';

import {FreegeoipService} from './freegeoip.service';

describe('FreegeoipService', () => {
  let service: FreegeoipService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FreegeoipService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
