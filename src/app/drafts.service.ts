import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { CertificateType, Selection } from './reference-text';

// Stored drafts of the signed-in user, via the backend's REST API
// (/api/drafts). The draft payload has the same format as the API's
// ReferenceDraft; DataStorageService converts the app's state into it.

export type DraftStatus = 'draft' | 'final';

export interface ReferenceDraft {
    schema_version: 1;
    certificate_type: CertificateType;
    form_data: { [name: string]: string | undefined };
    selections: Selection[];
}

export interface DraftSummary {
    id: string;
    status: DraftStatus;
    certificate_type: CertificateType;
    title: string;
    created_at: string;
    updated_at: string;
    expire_at: string;
}

export interface DraftView extends DraftSummary {
    draft: ReferenceDraft;
}

const API = 'api/drafts';

@Injectable({
    providedIn: 'root',
})
export class DraftsService {
    // False when the backend has no draft store (404) or the request failed.
    public readonly available = signal(false);
    public readonly retentionDays = signal(90);

    private http = inject(HttpClient);

    list(): Observable<DraftSummary[]> {
        return this.http.get<{ drafts: DraftSummary[]; retention_days: number }>(API).pipe(
            map((response) => {
                this.available.set(true);
                this.retentionDays.set(response.retention_days);
                return response.drafts;
            }),
            catchError(() => {
                this.available.set(false);
                return of([]);
            }),
        );
    }

    get(id: string): Observable<DraftView> {
        return this.http.get<DraftView>(`${API}/${encodeURIComponent(id)}`);
    }

    create(draft: ReferenceDraft): Observable<DraftView> {
        return this.http.post<DraftView>(API, draft);
    }

    replace(id: string, draft: ReferenceDraft): Observable<DraftView> {
        return this.http.put<DraftView>(`${API}/${encodeURIComponent(id)}`, draft);
    }

    finalize(id: string): Observable<DraftView> {
        return this.http.post<DraftView>(`${API}/${encodeURIComponent(id)}/finalize`, {});
    }

    delete(id: string): Observable<void> {
        return this.http.delete<void>(`${API}/${encodeURIComponent(id)}`);
    }

    export(id: string): Observable<object> {
        return this.http.get<object>(`${API}/${encodeURIComponent(id)}/export`);
    }

    import(data: unknown): Observable<DraftView> {
        return this.http.post<DraftView>(`${API}/import`, data);
    }

    // Offers the export as a file download. The file is not encrypted.
    download(data: object, title: string): void {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `zeugnis_${title.replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'entwurf'}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }
}
