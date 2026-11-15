
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { DataStorageService } from '../data-storage.service';
import { DraftListComponent } from '../draft-list/draft-list.component';
import { ThemeService } from '../theme.service';

@Component({
    selector: 'app-certificate-chooser',
    imports: [DraftListComponent, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
    templateUrl: './certificate-chooser.component.html',
    styleUrl: './certificate-chooser.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CertificateChooserComponent {
  public themeService = inject(ThemeService);
  private dataStorageService = inject(DataStorageService);
  private router = inject(Router);

  public loadData(certificateType: 'abschlusszeugnis' | 'zwischenzeugnis'): void {
    this.dataStorageService.loadDraftRefFromLocalStorage();
    // Another certificate type is another reference: the next save creates a new draft.
    if (certificateType !== this.dataStorageService.certificateType) {
      this.dataStorageService.setDraftRef(null, null);
    }
    this.dataStorageService.certificateType = certificateType;
    this.dataStorageService.saveDraftRefToLocalStorage();
    this.dataStorageService.loadTextModules().subscribe(response => {
      this.dataStorageService.inputData = response;
    });
    this.router.navigate(['/user-input']);
  }

}
