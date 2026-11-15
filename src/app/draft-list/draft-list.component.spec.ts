import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DraftListComponent } from './draft-list.component';

describe('DraftListComponent', () => {
    let fixture: ComponentFixture<DraftListComponent>;
    let http: HttpTestingController;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DraftListComponent],
            providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
        }).compileComponents();
        fixture = TestBed.createComponent(DraftListComponent);
        http = TestBed.inject(HttpTestingController);
        fixture.detectChanges();
    });

    it('lists the drafts with status and the retention note', () => {
        http.expectOne('api/drafts').flush({
            retention_days: 90,
            drafts: [
                {
                    id: 'a',
                    status: 'final',
                    certificate_type: 'abschlusszeugnis',
                    title: 'Anna Muster',
                    created_at: '2026-10-01T08:00:00Z',
                    updated_at: '2026-10-02T08:00:00Z',
                    expire_at: '2026-12-31T08:00:00Z',
                },
            ],
        });
        fixture.detectChanges();
        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(text).toContain('Anna Muster');
        expect(text).toContain('Final');
        expect(text).toContain('90 Tage');
    });

    it('stays hidden when the backend stores no drafts', () => {
        http.expectOne('api/drafts').flush({}, { status: 404, statusText: 'Not Found' });
        fixture.detectChanges();
        expect((fixture.nativeElement as HTMLElement).querySelector('section')).toBeNull();
    });
});
