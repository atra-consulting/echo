import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { forkJoin, switchMap } from 'rxjs';
import { DataStorageService } from '../data-storage.service';
import { DraftSummary, DraftsService } from '../drafts.service';

// The stored drafts of the signed-in user on the start page: open, export,
// delete, import. Hidden when the backend stores no drafts.
@Component({
    selector: 'app-draft-list',
    imports: [DatePipe, MatButtonModule, MatIconModule, MatTooltipModule],
    templateUrl: './draft-list.component.html',
    styleUrl: './draft-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DraftListComponent implements OnInit {
    public draftsService = inject(DraftsService);
    public drafts = signal<DraftSummary[]>([]);

    private dataStorageService = inject(DataStorageService);
    private router = inject(Router);
    private snackBar = inject(MatSnackBar);

    public ngOnInit(): void {
        this.refresh();
    }

    public refresh(): void {
        this.draftsService.list().subscribe((drafts) => this.drafts.set(drafts));
    }

    public typeLabel(draft: DraftSummary): string {
        return draft.certificate_type === 'abschlusszeugnis' ? 'Abschlusszeugnis' : 'Zwischenzeugnis';
    }

    public open(draft: DraftSummary): void {
        this.draftsService
            .get(draft.id)
            .pipe(
                switchMap((view) => {
                    this.dataStorageService.certificateType = view.draft.certificate_type;
                    this.dataStorageService.formData = { ...view.draft.form_data };
                    return forkJoin([[view], this.dataStorageService.loadTextModules()]);
                }),
            )
            .subscribe({
                next: ([view, textModules]) => {
                    this.dataStorageService.applyDraft(view, textModules);
                    this.router.navigate(['/user-input']);
                },
                error: () => this.notify('Der Entwurf konnte nicht geöffnet werden.'),
            });
    }

    public export(draft: DraftSummary): void {
        this.draftsService.export(draft.id).subscribe({
            next: (data) => this.draftsService.download(data, draft.title),
            error: () => this.notify('Der Export ist fehlgeschlagen.'),
        });
    }

    public delete(draft: DraftSummary): void {
        if (!confirm(`„${draft.title || 'Ohne Namen'}“ endgültig löschen?`)) {
            return;
        }
        this.draftsService.delete(draft.id).subscribe({
            next: () => {
                if (this.dataStorageService.draftId === draft.id) {
                    this.dataStorageService.setDraftRef(null, null);
                }
                this.refresh();
            },
            error: () => this.notify('Der Entwurf konnte nicht gelöscht werden.'),
        });
    }

    public async import(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file) {
            return;
        }
        let data: unknown;
        try {
            data = JSON.parse(await file.text());
        } catch {
            this.notify('Die Datei enthält kein gültiges JSON.');
            return;
        }
        this.draftsService.import(data).subscribe({
            next: () => {
                this.notify('Als neuer Entwurf importiert.');
                this.refresh();
            },
            error: () => this.notify('Die Datei ist kein gültiger Export des Zeugnisgenerators.'),
        });
    }

    private notify(message: string): void {
        this.snackBar.open(message, 'OK', { duration: 5000 });
    }
}
