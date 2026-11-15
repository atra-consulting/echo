import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CertificateChooserComponent } from './certificate-chooser.component';

describe('CertificateChooserComponent', () => {
  let component: CertificateChooserComponent;
  let fixture: ComponentFixture<CertificateChooserComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CertificateChooserComponent],
      // No real requests to /api: the backend does not run in unit tests.
      providers: [provideHttpClient(), provideHttpClientTesting()]
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
