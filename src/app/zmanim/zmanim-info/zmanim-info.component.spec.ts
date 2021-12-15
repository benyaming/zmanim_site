import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ZmanimInfoComponent } from './zmanim-info.component';

describe('ZmanimInfoComponent', () => {
  let component: ZmanimInfoComponent;
  let fixture: ComponentFixture<ZmanimInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ZmanimInfoComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ZmanimInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
