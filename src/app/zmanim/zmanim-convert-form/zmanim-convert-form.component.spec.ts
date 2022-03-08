import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ZmanimConvertFormComponent } from './zmanim-convert-form.component';

describe('ZmanimConvertFormComponent', () => {
  let component: ZmanimConvertFormComponent;
  let fixture: ComponentFixture<ZmanimConvertFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ZmanimConvertFormComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ZmanimConvertFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
