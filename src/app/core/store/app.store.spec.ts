import { TestBed } from '@angular/core/testing';

import { AppStore } from './app.store';

describe('ZmanimStateService', () => {
  let service: AppStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AppStore);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
