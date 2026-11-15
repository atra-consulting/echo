import { TitleCasePipe } from '@angular/common';
import { Component, OnInit, ChangeDetectionStrategy, inject, ChangeDetectorRef, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DATE_LOCALE,
  provideNativeDateAdapter,
} from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { Observable, map, switchMap, tap } from 'rxjs';
import { DataStorageService } from '../data-storage.service';
import { DraftView, DraftsService } from '../drafts.service';
import { GoogleAuthService } from '../google-auth.service';
import { GoogleDocService } from '../google-doc.service';
import { GOOGLE_DOCS_TEMPLATE_ID } from '../google.config';
import { ThemeService } from '../theme.service';
import { ReferenceOutputComponent } from '../reference-output/reference-output.component';
import { BlockRatingComponent } from './block-rating/block-rating.component';
import { BlockSelectorComponent } from './block-selector/block-selector.component';
import { IntroComponent } from './intro/intro.component';
import { PositionComponent } from './position/position.component';

// The parts of an HttpErrorResponse of /api/drafts that the messages need.
type DraftHttpError = { status?: number; error?: { error?: { code?: string } } };

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
  public draftsService = inject(DraftsService);
  private googleDocService = inject(GoogleDocService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  public ngOnInit(): void {
    this.dataStorageService.loadFormDataFromLocalStorage();
    this.dataStorageService.loadSelectedBlocksFromLocalStorage();
    this.dataStorageService.loadFlowTextFromLocalStorage();
    this.dataStorageService.loadDraftRefFromLocalStorage();
    // Shows the draft actions only when the backend stores drafts.
    this.draftsService.list().subscribe(() => this.cdr.markForCheck());
    this.dataStorageService
      .loadTextModules()
      .subscribe({
        next: (response) => {
          this.dataStorageService.inputData = response;
          this.dataStorageService.updateFlowText();
        },
        complete: () => this.cdr.markForCheck(),
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
      .loadTextModules()
      .subscribe({
        next: (response) => (this.dataStorageService.inputData = response),
        complete: () => this.cdr.markForCheck(),
      });
  }

  // Saves the inputs as a draft: the first save creates it, later ones replace it.
  public saveDraft(): void {
    this.save().subscribe({
      next: ({ unmatched }) =>
        this.notify(
          unmatched > 0
            ? `Gespeichert. ${unmatched} Auswahl(en) passen nicht zu den Textbausteinen und fehlen im Entwurf.`
            : 'Entwurf gespeichert.',
        ),
      error: (error) => this.notify(this.draftError(error, 'Speichern')),
    });
  }

  // Saves the current inputs first, so the final version is what the user sees.
  public finalizeDraft(): void {
    if (!confirm('Als final markieren? Danach lässt sich diese Fassung nicht mehr ändern.')) {
      return;
    }
    this.save()
      .pipe(switchMap(({ view }) => this.draftsService.finalize(view.id)))
      .subscribe({
        next: (view) => {
          this.takeOver(view);
          this.notify('Die Fassung ist final.');
        },
        error: (error) => this.notify(this.draftError(error, 'Abschließen')),
      });
  }

  private save(): Observable<{ view: DraftView; unmatched: number }> {
    const { draft, unmatched } = this.dataStorageService.toReferenceDraft();
    const id = this.dataStorageService.draftId;
    const request = id ? this.draftsService.replace(id, draft) : this.draftsService.create(draft);
    return request.pipe(
      tap((view) => this.takeOver(view)),
      map((view) => ({ view, unmatched })),
    );
  }

  public exportDraft(): void {
    const id = this.dataStorageService.draftId;
    if (!id) {
      this.notify('Bitte speichern Sie den Entwurf zuerst.');
      return;
    }
    this.draftsService.export(id).subscribe({
      next: (data) => this.draftsService.download(data, this.dataStorageService.formData.lastname ?? ''),
      error: (error) => this.notify(this.draftError(error, 'Exportieren')),
    });
  }

  // A final version stays as it is; its content continues as a new draft.
  public copyAsNewDraft(): void {
    this.dataStorageService.setDraftRef(null, null);
    this.saveDraft();
  }

  private takeOver(view: DraftView): void {
    this.dataStorageService.setDraftRef(view.id, view.status);
    this.cdr.markForCheck();
  }

  private draftError(error: DraftHttpError, action: string): string {
    if (error?.status === 409 && error.error?.error?.code === 'draft_conflict') {
      return 'Der Entwurf wurde inzwischen an anderer Stelle geändert. '
        + 'Bitte öffnen Sie ihn erneut über die Liste der Entwürfe.';
    }
    if (error?.status === 409) {
      return 'Die Fassung ist final und lässt sich nicht mehr ändern. '
        + 'Speichern Sie sie bei Bedarf als neuen Entwurf.';
    }
    if (error?.status === 404) {
      this.dataStorageService.setDraftRef(null, null);
      return 'Der Entwurf existiert nicht mehr. Speichern Sie erneut, um einen neuen anzulegen.';
    }
    return `${action} fehlgeschlagen. Bitte versuchen Sie es später erneut.`;
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'OK', { duration: 5000 });
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
