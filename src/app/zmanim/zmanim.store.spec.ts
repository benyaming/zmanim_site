import { TestBed } from '@angular/core/testing';

import { ZmanimStore } from './zmanim.store';

describe('ZmanimStateService', () => {
  let service: ZmanimStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ZmanimStore);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
