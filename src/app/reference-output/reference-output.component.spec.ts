import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReferenceOutputComponent } from './reference-output.component';

describe('ReferenceOutputComponent', () => {
  let component: ReferenceOutputComponent;
  let fixture: ComponentFixture<ReferenceOutputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReferenceOutputComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReferenceOutputComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
