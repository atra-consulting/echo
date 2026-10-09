
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { DataStorageService } from '../data-storage.service';
import { ThemeService } from '../theme.service';

@Component({
    selector: 'app-certificate-chooser',
    imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
    templateUrl: './certificate-chooser.component.html',
    styleUrl: './certificate-chooser.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CertificateChooserComponent {
  public themeService = inject(ThemeService);
  private dataStorageService = inject(DataStorageService);
  private router = inject(Router);

  public loadData(certificateType: 'abschlusszeugnis' | 'zwischenzeugnis'): void {
    this.dataStorageService.dataUrl = 'assets/data_' + certificateType + '.json';
    this.dataStorageService.certificateType = certificateType;
    this.dataStorageService.getData(this.dataStorageService.dataUrl).subscribe(response => {
      this.dataStorageService.inputData = response;
    });
    this.router.navigate(['/user-input']);
  }

}
