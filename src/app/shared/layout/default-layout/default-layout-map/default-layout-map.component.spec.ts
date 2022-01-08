import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DefaultLayoutMapComponent } from './default-layout-map.component';

describe('DefaultLayoutMapComponent', () => {
  let component: DefaultLayoutMapComponent;
  let fixture: ComponentFixture<DefaultLayoutMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DefaultLayoutMapComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DefaultLayoutMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
