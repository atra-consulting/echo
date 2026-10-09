import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CertificateChooserComponent } from './certificate-chooser.component';

describe('CertificateChooserComponent', () => {
  let component: CertificateChooserComponent;
  let fixture: ComponentFixture<CertificateChooserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CertificateChooserComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CertificateChooserComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
