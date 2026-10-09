import { TitleCasePipe } from '@angular/common';
import { Component, OnInit, ChangeDetectionStrategy, inject, ChangeDetectorRef, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DATE_LOCALE,
  provideNativeDateAdapter,
} from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { DataStorageService } from '../data-storage.service';
import { GoogleAuthService } from '../google-auth.service';
import { GoogleDocService } from '../google-doc.service';
import { GOOGLE_DOCS_TEMPLATE_ID } from '../google.config';
import { ThemeService } from '../theme.service';
import { ReferenceOutputComponent } from '../reference-output/reference-output.component';
import { BlockRatingComponent } from './block-rating/block-rating.component';
import { BlockSelectorComponent } from './block-selector/block-selector.component';
import { IntroComponent } from './intro/intro.component';
import { PositionComponent } from './position/position.component';

@Component({
    selector: 'app-user-input',
    templateUrl: './user-input.component.html',
    styleUrl: './user-input.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        BlockRatingComponent,
        BlockSelectorComponent,
        TitleCasePipe,
        IntroComponent,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatStepperModule,
        MatTooltipModule,
        PositionComponent,
        ReferenceOutputComponent,
    ],
    providers: [
        provideNativeDateAdapter(),
        { provide: MAT_DATE_LOCALE, useValue: 'de-DE' },
    ]
})
export class UserInputComponent implements OnInit {
  @ViewChild('stepper') stepper!: MatStepper;

  private readonly fieldToStep: Record<string, string> = {
    salutation: 'intro',
    firstname: 'intro',
    lastname: 'intro',
    birthdate: 'intro',
    birthplace: 'intro',
    hiredate: 'intro',
    enddate: 'intro',
    job_title: 'intro',
    business_area: 'position',
    area_of_expertise: 'position',
    projects: 'position',
    task_list: 'position',
  };

  public themeService = inject(ThemeService);
  public dataStorageService = inject(DataStorageService);
  public googleAuthService = inject(GoogleAuthService);
  private googleDocService = inject(GoogleDocService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  public ngOnInit(): void {
    this.dataStorageService.loadFormDataFromLocalStorage();
    this.dataStorageService.loadSelectedBlocksFromLocalStorage();
    this.dataStorageService.loadFlowTextFromLocalStorage();
    this.dataStorageService
      .getData(this.dataStorageService.dataUrl)
      .subscribe((response) => {
        this.dataStorageService.inputData = response;
        this.dataStorageService.updateFlowText();
        this.cdr.markForCheck();
      });
  }

  public back(): void {
    this.router.navigate(['/certificate-chooser']);
  }

  public signIn(): void {
    this.googleAuthService.signIn();
  }

  public exportToGoogleSheet(): void {
    const certificateType = this.dataStorageService.certificateType;
    const name =
      this.dataStorageService.formData.firstname +
      this.dataStorageService.formData.lastname;
    const date = new Date().toLocaleDateString();
    this.googleDocService.createSheetAndSaveData(
      'atra_' + certificateType + '_' + name + '_' + date + '.gsheet',
      this.dataStorageService.formData, this.dataStorageService.selectedBlocks
    );
  }

  public exportToGoogleDoc(): void {
    const flowText = this.dataStorageService.getFlowText();
    const certificateType = this.dataStorageService.certificateType;
    const name =
      this.dataStorageService.formData.firstname +
      this.dataStorageService.formData.lastname;
    const date = new Date().toLocaleDateString();
    this.googleDocService.createDocument(
      GOOGLE_DOCS_TEMPLATE_ID,
      'atra_' + certificateType + '_' + name + '_' + date + '.gdoc',
      flowText
    );
  }

  public resetLocalStorage(): void {
    this.dataStorageService.resetLocalStorage();
    this.dataStorageService.inputData = null;
    this.dataStorageService
      .getData(this.dataStorageService.dataUrl)
      .subscribe((response) => {
        this.dataStorageService.inputData = response;
        this.cdr.markForCheck();
      });
  }

  public signOut(): void {
    this.googleAuthService.signOut();
  }

  public navigateToField(fieldName: string): void {
    const stepName = this.fieldToStep[fieldName];
    if (!stepName || !this.stepper) return;

    const stepIndex = this.dataStorageService.inputData?.textblocks
      ?.findIndex((b: any) => b.name === stepName);
    if (stepIndex == null || stepIndex < 0) return;

    this.stepper.selectedIndex = stepIndex;
    this.cdr.detectChanges();

    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[name="${fieldName}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.focus();
      } else {
        el.click();
      }
    }, 400);
  }
}
