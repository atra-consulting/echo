import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
    CertificateType,
    SelectedBlocks,
    assembleHtml,
    assembleText,
    replacePlaceholders,
    textModulesFileName,
} from './reference-text';

@Injectable({
    providedIn: 'root',
})
export class DataStorageService {
    public certificateType: CertificateType = 'abschlusszeugnis';
    public dataUrl = 'assets/data_abschlusszeugnis.json';
    public inputData: any;
    public selectedBlocks: SelectedBlocks = {};
    public formData: any = {};
    public flowText: string = '';
    public flowTextHtml: string = '';
    public birthdate: Date | null = null;
    public hiredate: Date | null = null;
    public enddate: Date | null = null;

    private http = inject(HttpClient);

    getData(url: string): Observable<any> {
        this.updateDataUrl();
        return this.http.get<any>(url ? url : this.dataUrl);
    }

    public updateDataUrl(): void {
        this.dataUrl = 'assets/' + textModulesFileName(this.certificateType, this.formData.salutation);
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

    resetLocalStorage(): void {
        localStorage.removeItem('formData');
        localStorage.removeItem('selectedBlocks');
        localStorage.removeItem('flowText');
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
