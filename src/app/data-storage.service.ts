import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class DataStorageService {
    public certificateType: 'abschlusszeugnis' | 'zwischenzeugnis' =
        'abschlusszeugnis';
    public dataUrl = 'assets/data_abschlusszeugnis.json';
    public inputData: any;
    public selectedBlocks: {
        [topic: string]: { [subtopic: string]: { text: string; rating: string } };
    } = {};
    public formData: any = {};
    public flowText: string = '';
    public flowTextHtml: string = '';
    public birthdate: Date | null = null;
    public hiredate: Date | null = null;
    public enddate: Date | null = null;

    private readonly placeholderLabels: Record<string, string> = {
        salutation: 'Anrede',
        firstname: 'Vorname',
        lastname: 'Nachname',
        birthdate: 'Geburtsdatum',
        birthplace: 'Geburtsort',
        hiredate: 'Startdatum',
        enddate: 'Enddatum',
        job_title: 'Jobtitel',
        business_area: 'Geschäftsbereich',
        area_of_expertise: 'Kompetenzbereich',
        task_list: 'Aufgaben',
        projects: 'Projekte',
        sales_region: 'Verkaufsgebiet',
        promotion_date: 'Beförderungsdatum',
        department: 'Abteilung',
    };

    private http = inject(HttpClient);

    getData(url: string): Observable<any> {
        this.updateDataUrl();
        return this.http.get<any>(url ? url : this.dataUrl);
    }

    public updateDataUrl(): void {
        const isFemale = this.formData.salutation === 'Frau';
        const type = this.certificateType;
        if (isFemale) {
            this.dataUrl = `assets/data_female_${type}.json`;
        } else {
            this.dataUrl = `assets/data_${type}.json`;
        }
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
        if (typeof text !== 'string') {
            return '';
        }
        return text.replace(
            /{(\w+)}/g,
            (_, key) => {
                const label = this.placeholderLabels[key] || key;
                return this.formData[key] || `[${label}]`;
            }
        );
    }

    private replacePlaceholdersHtml(text: string): string {
        if (typeof text !== 'string') {
            return '';
        }
        const escaped = this.escapeHtml(text);
        return escaped.replace(
            /\{(\w+)\}/g,
            (_, key) => {
                if (this.formData[key]) {
                    return this.escapeHtml(this.formData[key]);
                }
                const label = this.placeholderLabels[key] || key;
                return `<span class="placeholder placeholder--${key}">[${label}]</span>`;
            }
        );
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    public updateFlowText(): void {
        const rawTexts = this.assembleRawTexts();
        this.flowText = rawTexts.map(t => this.replacePlaceholders(t)).join('\n\n');
        this.flowTextHtml = rawTexts.map(t => this.replacePlaceholdersHtml(t)).join('<br><br>');
        this.saveFlowTextToLocalStorage();
    }

    private assembleRawTexts(): string[] {
        const topics = this.inputData?.textblocks.map((t: any) => t.name) || Object.keys(this.selectedBlocks);

        return topics
            .map((topic: string) => {
                if (!this.selectedBlocks[topic]) {
                    return '';
                }
                const topicBlock = this.inputData.textblocks.find(
                    (block: any) => block.name === topic
                );
                const subtopicsOrder =
                    topicBlock?.options.map((option: any) => option.name) || [];

                const subtopicTexts = subtopicsOrder
                    .map((subtopic: string) => this.selectedBlocks[topic][subtopic]?.text)
                    .filter((text: string) => text);

                if (subtopicTexts.length === 0 && topicBlock?.options.length > 0) {
                    return this.selectedBlocks[topic]['option']?.text || '';
                }

                return subtopicTexts.join(' ');
            })
            .filter((t: string) => t);
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
