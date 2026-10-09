import { Injectable, inject } from '@angular/core';
import { GoogleAuthService } from './google-auth.service';

// Exports via the Google REST APIs (Drive, Docs, Sheets) using the access
// token from GoogleAuthService. No client library needed.
@Injectable({
    providedIn: 'root',
})
export class GoogleDocService {
    private googleAuthService = inject(GoogleAuthService);

    // Creates a copy of the template document in the user's Drive and
    // inserts the reference text. The template itself stays untouched.
    public async createDocument(templateId: string, title: string, content: string): Promise<void> {
        try {
            const copy = await this.post<{ id: string }>(
                `https://www.googleapis.com/drive/v3/files/${templateId}/copy`,
                { name: title },
            );
            await this.post(`https://docs.googleapis.com/v1/documents/${copy.id}:batchUpdate`, {
                requests: [
                    {
                        insertText: {
                            location: { segmentId: '', index: 1 },
                            text: content,
                        },
                    },
                ],
            });
            alert('Das Zeugnis wurde in Ihrer Ablage gespeichert');
        } catch (error) {
            console.error('Error exporting to Google Docs:', error);
            alert('Der Export nach Google Docs ist fehlgeschlagen. Bitte melden Sie sich erneut an und versuchen Sie es noch einmal.');
        }
    }

    // Creates a new spreadsheet in the user's Drive and stores the form
    // data plus the selected text blocks.
    public async createSheetAndSaveData(
        title: string,
        data: { [key: string]: string },
        selectedBlocks: {
            [topic: string]: { [subtopic: string]: { text: string; rating: string } };
        },
    ): Promise<void> {
        try {
            // The sheet name is set explicitly because the default name of a
            // new spreadsheet depends on the user's locale.
            const spreadsheet = await this.post<{ spreadsheetId: string }>(
                'https://sheets.googleapis.com/v4/spreadsheets',
                {
                    properties: { title: title },
                    sheets: [{ properties: { title: 'Daten' } }],
                },
            );

            const values: string[][] = [];
            for (const key of Object.keys(data)) {
                values.push([key, data[key]]);
            }
            for (const topic of Object.keys(selectedBlocks)) {
                for (const subtopic of Object.keys(selectedBlocks[topic])) {
                    const block = selectedBlocks[topic][subtopic];
                    values.push([`${topic} - ${subtopic}`, block.text, block.rating]);
                }
            }

            await this.post(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.spreadsheetId}` +
                    '/values/Daten!A1:append?valueInputOption=RAW',
                { values: values },
            );
            alert('Die Formulardaten wurden in Ihrer Ablage gespeichert');
        } catch (error) {
            console.error('Error exporting to Google Sheets:', error);
            alert('Der Export nach Google Sheets ist fehlgeschlagen. Bitte melden Sie sich erneut an und versuchen Sie es noch einmal.');
        }
    }

    private async post<T>(url: string, body: unknown): Promise<T> {
        const token = await this.googleAuthService.getAccessToken();
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw new Error(`Google API request failed (${response.status}): ${await response.text()}`);
        }
        return response.json() as Promise<T>;
    }
}
