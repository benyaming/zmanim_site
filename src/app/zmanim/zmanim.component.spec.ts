import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ZmanimComponent} from './zmanim.component';

describe('ZmanimComponent', () => {
  let component: ZmanimComponent;
  let fixture: ComponentFixture<ZmanimComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ZmanimComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ZmanimComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
