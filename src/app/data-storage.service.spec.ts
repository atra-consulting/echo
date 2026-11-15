import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DataStorageService } from './data-storage.service';
import { TextModules } from './reference-text';

describe('DataStorageService', () => {
    let service: DataStorageService;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
        service = TestBed.inject(DataStorageService);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('loads the text modules of the certificate type from the API', () => {
        const textModules: TextModules = { textblocks: [] };
        let loaded: TextModules | undefined;
        service.certificateType = 'zwischenzeugnis';
        service.loadTextModules().subscribe((response) => (loaded = response));

        const request = http.expectOne('api/certificate-types/zwischenzeugnis/text-modules');
        expect(request.request.params.keys()).toEqual([]);
        request.flush(textModules);
        expect(loaded).toEqual(textModules);
    });

    it('requests the female variant for the salutation "Frau"', () => {
        service.formData = { salutation: 'Frau' };
        service.loadTextModules().subscribe();

        const request = http.expectOne((r) => r.url === 'api/certificate-types/abschlusszeugnis/text-modules');
        expect(request.request.params.get('salutation')).toBe('Frau');
        request.flush({ textblocks: [] });
    });

    it('reports a failed request instead of throwing', () => {
        spyOn(console, 'error');
        let completed = false;
        service.loadTextModules().subscribe({ complete: () => (completed = true) });

        http.expectOne('api/certificate-types/abschlusszeugnis/text-modules').flush(null, {
            status: 503,
            statusText: 'Service Unavailable',
        });
        expect(service.textModulesError).toBeTrue();
        expect(completed).toBeTrue();
    });

    it('converts the state into a draft of the API and carries selections over to another variant', () => {
        const male: TextModules = {
            textblocks: [{ name: 'intro', type: 'topic', title: '1.', options: ['Er kam.', 'Er blieb.'] }],
        };
        const female: TextModules = {
            textblocks: [{ name: 'intro', type: 'topic', title: '1.', options: ['Sie kam.', 'Sie blieb.'] }],
        };
        service.certificateType = 'zwischenzeugnis';
        service.inputData = male;
        service.formData = { salutation: 'Frau', lastname: 'Muster', unknown: 'x', firstname: '' };
        service.selectedBlocks = { intro: { option: { text: 'Er blieb.', rating: '' } } };

        expect(service.toReferenceDraft()).toEqual({
            draft: {
                schema_version: 1,
                certificate_type: 'zwischenzeugnis',
                form_data: { salutation: 'Frau', lastname: 'Muster' },
                selections: [{ step: 'intro', sentence: 1 }],
            },
            unmatched: 0,
        });

        service.switchTextModules(female);
        expect(service.selectedBlocks['intro']['option'].text).toBe('Sie blieb.');
    });
});
