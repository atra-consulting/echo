import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable, catchError } from 'rxjs';
import { DraftStatus, DraftView, ReferenceDraft } from './drafts.service';
import {
    CertificateType,
    PLACEHOLDER_LABELS,
    SelectedBlocks,
    TextModules,
    assembleHtml,
    assembleText,
    blocksToSelections,
    replacePlaceholders,
    selectionsToBlocks,
} from './reference-text';

// Base path of the backend's REST API, relative to the base href. ng dev
// forwards it to the backend (proxy.conf.json), in the container nginx does.
const API_BASE = 'api';

@Injectable({
    providedIn: 'root',
})
export class DataStorageService {
    public certificateType: CertificateType = 'abschlusszeugnis';
    public inputData: any;
    public textModulesError = false;
    // The stored draft the current inputs belong to; null until the first save.
    public draftId: string | null = null;
    public draftStatus: DraftStatus | null = null;
    public selectedBlocks: SelectedBlocks = {};
    public formData: any = {};
    public flowText: string = '';
    public flowTextHtml: string = '';
    public birthdate: Date | null = null;
    public hiredate: Date | null = null;
    public enddate: Date | null = null;

    private http = inject(HttpClient);

    // Loads the text modules of the current certificate type from the backend,
    // in the female variant for the salutation "Frau". On failure the observable
    // completes without a value and textModulesError is set.
    loadTextModules(): Observable<TextModules> {
        this.textModulesError = false;
        const salutation = this.formData.salutation;
        const params: Record<string, string> = salutation === 'Herr' || salutation === 'Frau' ? { salutation } : {};
        const url = `${API_BASE}/certificate-types/${this.certificateType}/text-modules`;
        return this.http.get<TextModules>(url, { params }).pipe(
            catchError((error) => {
                console.error('Loading the text modules failed:', error?.status);
                this.textModulesError = true;
                return EMPTY;
            }),
        );
    }

    setFormData(key: string, value: any): void {
        this.formData[key] = value;
        this.saveFormDataToLocalStorage();
        this.updateFlowText();
    }

    saveFormDataToLocalStorage(): void {
        localStorage.setItem('formData', JSON.stringify(this.formData));
    }

    loadFormDataFromLocalStorage(): void {
        const savedFormData = localStorage.getItem('formData');
        if (savedFormData) {
            this.formData = JSON.parse(savedFormData);
        }
    }

    setSelectedBlock(
        topic: string,
        subtopic: string,
        value: string,
        rating?: string
    ): void {
        if (!this.selectedBlocks[topic]) {
            this.selectedBlocks[topic] = {};
        }
        if (rating !== undefined) {
            this.selectedBlocks[topic][subtopic] = {text: value, rating: rating};
        } else {
            this.selectedBlocks[topic][subtopic].text = value;
        }
        this.updateFlowText();
        this.saveSelectedBlocksToLocalStorage();
    }

    getSelectedBlock(
        topic: string,
        subtopic: string
    ): { text: string; rating: string } {
        const selectedBlock = this.selectedBlocks[topic]?.[subtopic];
        return selectedBlock;
    }

    saveSelectedBlocksToLocalStorage(): void {
        localStorage.setItem('selectedBlocks', JSON.stringify(this.selectedBlocks));
    }

    loadSelectedBlocksFromLocalStorage(): void {
        const savedSelectedBlocks = localStorage.getItem('selectedBlocks');
        if (savedSelectedBlocks) {
            this.selectedBlocks = JSON.parse(savedSelectedBlocks);
        }
    }

    // Certificate type and the draft the inputs belong to survive a reload like the inputs themselves.
    saveDraftRefToLocalStorage(): void {
        const ref = { certificate_type: this.certificateType, id: this.draftId, status: this.draftStatus };
        localStorage.setItem('draft', JSON.stringify(ref));
    }

    loadDraftRefFromLocalStorage(): void {
        try {
            const saved = JSON.parse(localStorage.getItem('draft') || 'null');
            if (saved?.certificate_type === 'abschlusszeugnis' || saved?.certificate_type === 'zwischenzeugnis') {
                this.certificateType = saved.certificate_type;
            }
            this.draftId = typeof saved?.id === 'string' ? saved.id : null;
            this.draftStatus = saved?.status === 'final' ? 'final' : this.draftId ? 'draft' : null;
        } catch {
            this.draftId = null;
            this.draftStatus = null;
        }
    }

    setDraftRef(id: string | null, status: DraftStatus | null): void {
        this.draftId = id;
        this.draftStatus = status;
        this.saveDraftRefToLocalStorage();
    }

    // The current state in the format of the API. unmatched counts selected
    // texts that the loaded text modules do not contain.
    toReferenceDraft(): { draft: ReferenceDraft; unmatched: number } {
        const formData = Object.fromEntries(
            Object.keys(PLACEHOLDER_LABELS)
                .filter((name) => typeof this.formData[name] === 'string' && this.formData[name] !== '')
                .map((name) => [name, this.formData[name]]),
        );
        const { selections, unmatched } = blocksToSelections(this.inputData, this.selectedBlocks);
        return {
            draft: { schema_version: 1, certificate_type: this.certificateType, form_data: formData, selections },
            unmatched,
        };
    }

    // Takes over a stored draft; textModules must be the variant of the draft.
    applyDraft(view: DraftView, textModules: TextModules): void {
        this.certificateType = view.draft.certificate_type;
        this.formData = { ...view.draft.form_data };
        this.inputData = textModules;
        this.selectedBlocks = selectionsToBlocks(textModules, view.draft.selections);
        this.birthdate = null;
        this.hiredate = null;
        this.enddate = null;
        this.setDraftRef(view.id, view.status);
        this.saveFormDataToLocalStorage();
        this.saveSelectedBlocksToLocalStorage();
        this.updateFlowText();
    }

    // Switches to another variant of the text modules (salutation) and carries
    // the selected sentences over to the same positions in the new variant.
    switchTextModules(textModules: TextModules): void {
        if (this.inputData) {
            const { selections } = blocksToSelections(this.inputData, this.selectedBlocks);
            const carried = selectionsToBlocks(textModules, selections);
            for (const [topic, blocks] of Object.entries(carried)) {
                this.selectedBlocks[topic] = { ...this.selectedBlocks[topic], ...blocks };
            }
            this.saveSelectedBlocksToLocalStorage();
        }
        this.inputData = textModules;
        this.updateFlowText();
    }

    resetLocalStorage(): void {
        localStorage.removeItem('formData');
        localStorage.removeItem('selectedBlocks');
        localStorage.removeItem('flowText');
        localStorage.removeItem('draft');
        this.draftId = null;
        this.draftStatus = null;
        this.formData = {};
        this.selectedBlocks = {};
        this.flowText = '';
        this.flowTextHtml = '';
        this.birthdate = null;
        this.hiredate = null;
        this.enddate = null;
    }

    getFlowText(): string {
        return this.flowText;
    }

    refreshData(options: any[]): string[] {
        return options.filter((o): o is string => typeof o === 'string');
    }

    public replacePlaceholders(text: string): string {
        return replacePlaceholders(text, this.formData);
    }

    public updateFlowText(): void {
        this.flowText = assembleText(this.inputData, this.selectedBlocks, this.formData);
        this.flowTextHtml = assembleHtml(this.inputData, this.selectedBlocks, this.formData);
        this.saveFlowTextToLocalStorage();
    }

    public saveFlowTextToLocalStorage(): void {
        localStorage.setItem('flowText', this.flowText);
    }

    public loadFlowTextFromLocalStorage(): void {
        const savedFlowText = localStorage.getItem('flowText');
        if (savedFlowText) {
            this.flowText = savedFlowText;
        }
    }
}
