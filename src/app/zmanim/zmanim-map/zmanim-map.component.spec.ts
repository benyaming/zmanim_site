import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ZmanimMapComponent } from './zmanim-map.component';

describe('LocationComponent', () => {
  let component: ZmanimMapComponent;
  let fixture: ComponentFixture<ZmanimMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ZmanimMapComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ZmanimMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
