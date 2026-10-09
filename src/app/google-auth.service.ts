import { Injectable, signal } from '@angular/core';
import { GOOGLE_CLIENT_ID } from './google.config';

// Google Identity Services (GIS) token client. Replaces the deprecated
// gapi.auth2 library which Google no longer supports.
// The client id is configured in google.config.ts.
const SCOPES =
    'https://www.googleapis.com/auth/documents ' +
    'https://www.googleapis.com/auth/spreadsheets ' +
    'https://www.googleapis.com/auth/drive';
const GSI_SRC = 'https://accounts.google.com/gsi/client';

@Injectable({
    providedIn: 'root',
})
export class GoogleAuthService {
    private accessToken: string | null = null;
    private tokenExpiresAt = 0;
    private readonly signedIn = signal(false);
    private gsiLoaded: Promise<void> | null = null;

    public async signIn(): Promise<void> {
        await this.requestToken();
    }

    public async signOut(): Promise<void> {
        if (this.accessToken) {
            await this.loadGsi();
            google.accounts.oauth2.revoke(this.accessToken, () => undefined);
        }
        this.accessToken = null;
        this.tokenExpiresAt = 0;
        this.signedIn.set(false);
    }

    public isSignedIn(): boolean {
        return this.signedIn() && Date.now() < this.tokenExpiresAt;
    }

    // Returns a valid access token, prompting the user again if the previous
    // token has expired (tokens are only valid for about an hour).
    public async getAccessToken(): Promise<string> {
        if (this.accessToken && Date.now() < this.tokenExpiresAt) {
            return this.accessToken;
        }
        return this.requestToken();
    }

    private async requestToken(): Promise<string> {
        await this.loadGsi();
        return new Promise<string>((resolve, reject) => {
            const client = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: SCOPES,
                callback: (response) => {
                    if (response.error) {
                        reject(new Error(response.error_description ?? response.error));
                        return;
                    }
                    this.accessToken = response.access_token;
                    this.tokenExpiresAt = Date.now() + (Number(response.expires_in) - 60) * 1000;
                    this.signedIn.set(true);
                    resolve(response.access_token);
                },
                error_callback: (error) => {
                    reject(new Error(error.message));
                },
            });
            client.requestAccessToken();
        });
    }

    private loadGsi(): Promise<void> {
        if (!this.gsiLoaded) {
            this.gsiLoaded = new Promise((resolve, reject) => {
                if (typeof google !== 'undefined' && google.accounts?.oauth2) {
                    resolve();
                    return;
                }
                const script = document.createElement('script');
                script.src = GSI_SRC;
                script.async = true;
                script.onload = () => resolve();
                script.onerror = () => {
                    this.gsiLoaded = null;
                    reject(new Error('Google Identity Services could not be loaded'));
                };
                document.head.appendChild(script);
            });
        }
        return this.gsiLoaded;
    }
}
