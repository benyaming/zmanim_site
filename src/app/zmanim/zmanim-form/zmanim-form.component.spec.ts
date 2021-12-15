import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ZmanimFormComponent } from './zmanim-form.component';

describe('ZmanimFormComponent', () => {
  let component: ZmanimFormComponent;
  let fixture: ComponentFixture<ZmanimFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ZmanimFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ZmanimFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
