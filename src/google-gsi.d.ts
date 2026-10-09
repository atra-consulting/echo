// Minimal type declarations for Google Identity Services (GIS).
// Reference: https://developers.google.com/identity/oauth2/web/reference/js-reference
declare namespace google.accounts.oauth2 {
    interface TokenResponse {
        access_token: string;
        expires_in: string;
        scope: string;
        token_type: string;
        error?: string;
        error_description?: string;
    }

    interface ClientConfigError {
        type: string;
        message: string;
    }

    interface TokenClientConfig {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: ClientConfigError) => void;
    }

    interface TokenClient {
        requestAccessToken(overrideConfig?: { prompt?: string }): void;
    }

    function initTokenClient(config: TokenClientConfig): TokenClient;
    function revoke(accessToken: string, done?: () => void): void;
}
