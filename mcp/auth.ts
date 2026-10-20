// OAuth for the MCP server with Google as identity provider.
//
// MCP clients such as claude.ai expect an authorization server with dynamic
// client registration, which Google does not offer. The server therefore acts
// as its own authorization server and delegates the sign-in to Google: it
// accepts only verified accounts of one Google Workspace domain and issues its
// own tokens. All state (clients, codes, tokens) lives in encrypted JWTs, so
// no database is needed and any instance can serve any request.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Request, Response } from 'express';
import { EncryptJWT, JWTPayload, JWTVerifyGetKey, createRemoteJWKSet, jwtDecrypt, jwtVerify } from 'jose';
import { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import {
    InvalidClientMetadataError,
    InvalidGrantError,
    InvalidTargetError,
    InvalidTokenError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { AuthorizationParams, OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { OAuthClientInformationFull, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js';

export interface GoogleAuthConfig {
    // Public base URL of the server, e.g. https://zeugnisgenerator-mcp.example.com
    publicUrl: URL;
    googleClientId: string;
    googleClientSecret: string;
    // Google Workspace domain whose accounts may sign in, e.g. atra.consulting
    allowedDomain: string;
    // 32 bytes for the A256GCM encryption of all tokens
    tokenKey: Uint8Array;
    // Keys for Google's ID tokens; replaced in tests
    googleKeys?: JWTVerifyGetKey;
}

export const GOOGLE_CALLBACK_PATH = '/oauth/google/callback';

// Clients may only register these redirect URIs, plus loopback URIs on any
// port for local clients such as Claude Code. Otherwise anyone could register
// a client that sends the codes of signed-in users to their own server.
const ALLOWED_REDIRECT_URIS = ['https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback'];
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_URL = new URL('https://www.googleapis.com/oauth2/v3/certs');

const NONCE_COOKIE = 'zeugnisgenerator_oauth_nonce';
const AUTHORIZE_TTL = 10 * 60;
const CODE_TTL = 2 * 60;
const ACCESS_TOKEN_TTL = 60 * 60;
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60;

type TokenKind = 'client' | 'authorize' | 'code' | 'access' | 'refresh';

interface ClientClaims {
    redirect_uris: string[];
    client_name?: string;
}

interface AuthorizeClaims {
    client_id: string;
    redirect_uri: string;
    code_challenge: string;
    state?: string;
    scopes: string[];
    resource: string;
    nonce: string;
}

interface CodeClaims {
    client_id: string;
    redirect_uri: string;
    code_challenge: string;
    scopes: string[];
    resource: string;
    email: string;
    google_refresh_token?: string;
}

interface AccessClaims {
    client_id: string;
    scopes: string[];
    resource: string;
    email: string;
}

interface RefreshClaims {
    client_id: string;
    scopes: string[];
    resource: string;
    email: string;
    google_refresh_token: string;
}

interface GoogleTokenResponse {
    id_token?: string;
    refresh_token?: string;
}

export class GoogleOAuthProvider implements OAuthServerProvider {
    public readonly resourceUrl: URL;
    private readonly callbackUrl: string;
    private readonly googleKeys: JWTVerifyGetKey;
    // Codes are meant for single use. Without shared storage this is enforced
    // per instance only; the short lifetime and PKCE cover the rest.
    private readonly usedCodes = new Map<string, number>();

    constructor(private readonly config: GoogleAuthConfig) {
        this.resourceUrl = new URL('/mcp', config.publicUrl);
        this.callbackUrl = new URL(GOOGLE_CALLBACK_PATH, config.publicUrl).href;
        this.googleKeys = config.googleKeys ?? createRemoteJWKSet(GOOGLE_JWKS_URL);
    }

    public get clientsStore(): OAuthRegisteredClientsStore {
        return {
            getClient: async (clientId) => {
                const claims = await this.open<ClientClaims>('client', clientId).catch(() => undefined);
                if (!claims) {
                    return undefined;
                }
                return {
                    client_id: clientId,
                    client_name: claims.client_name,
                    redirect_uris: claims.redirect_uris,
                    token_endpoint_auth_method: 'none',
                };
            },
            registerClient: async (client) => {
                const disallowed = client.redirect_uris.filter((uri) => !isAllowedRedirectUri(uri));
                if (disallowed.length > 0) {
                    throw new InvalidClientMetadataError(`redirect_uri not allowed: ${disallowed.join(', ')}`);
                }
                const claims: ClientClaims = { redirect_uris: client.redirect_uris, client_name: client.client_name };
                // Public client: the client id carries its metadata, there is no secret to store.
                return {
                    ...client,
                    client_id: await this.seal('client', claims),
                    client_id_issued_at: Math.floor(Date.now() / 1000),
                    client_secret: undefined,
                    client_secret_expires_at: undefined,
                    token_endpoint_auth_method: 'none',
                };
            },
        };
    }

    public async authorize(
        client: OAuthClientInformationFull,
        params: AuthorizationParams,
        res: Response,
    ): Promise<void> {
        const resource = this.checkResource(params.resource);
        const nonce = randomBytes(16).toString('base64url');
        const state = await this.seal<AuthorizeClaims>(
            'authorize',
            {
                client_id: client.client_id,
                redirect_uri: params.redirectUri,
                code_challenge: params.codeChallenge,
                state: params.state,
                scopes: params.scopes ?? [],
                resource: resource,
                nonce: nonce,
            },
            AUTHORIZE_TTL,
        );

        // Binds the callback to the browser that started the sign-in (login CSRF).
        res.cookie(NONCE_COOKIE, nonce, {
            httpOnly: true,
            secure: this.config.publicUrl.protocol === 'https:',
            sameSite: 'lax',
            path: GOOGLE_CALLBACK_PATH,
            maxAge: AUTHORIZE_TTL * 1000,
        });

        const url = new URL(GOOGLE_AUTHORIZE_URL);
        url.search = new URLSearchParams({
            client_id: this.config.googleClientId,
            redirect_uri: this.callbackUrl,
            response_type: 'code',
            scope: 'openid email',
            state: state,
            hd: this.config.allowedDomain,
            // A Google refresh token lets the server check the account on every
            // token refresh; Google only returns it with consent.
            access_type: 'offline',
            prompt: 'consent',
        }).toString();
        res.redirect(302, url.href);
    }

    // Google redirects here after the sign-in. Exchanges the Google code,
    // checks the account and sends the client its authorization code.
    public async handleGoogleCallback(req: Request, res: Response): Promise<void> {
        res.setHeader('Cache-Control', 'no-store');
        res.clearCookie(NONCE_COOKIE, { path: GOOGLE_CALLBACK_PATH });

        const authorize = await this.open<AuthorizeClaims>('authorize', String(req.query['state'] ?? '')).catch(
            () => undefined,
        );
        if (!authorize) {
            res.status(400).send('Die Anmeldung ist abgelaufen oder ungültig. Bitte starten Sie sie erneut.');
            return;
        }
        const nonce = readCookie(req, NONCE_COOKIE);
        if (!nonce || !safeEqual(nonce, authorize.nonce)) {
            res.status(400).send(
                'Die Anmeldung wurde in einem anderen Browser gestartet. Bitte starten Sie sie erneut.',
            );
            return;
        }

        const redirect = new URL(authorize.redirect_uri);
        if (authorize.state !== undefined) {
            redirect.searchParams.set('state', authorize.state);
        }
        const code = req.query['code'];
        if (typeof code !== 'string') {
            redirect.searchParams.set('error', 'access_denied');
            redirect.searchParams.set('error_description', 'Google sign-in was cancelled');
            res.redirect(302, redirect.href);
            return;
        }

        const tokens = await this.googleToken({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: this.callbackUrl,
        });
        const email = tokens ? await this.allowedEmail(tokens.id_token) : undefined;
        if (!tokens || !email) {
            redirect.searchParams.set('error', 'access_denied');
            redirect.searchParams.set(
                'error_description',
                `Only verified ${this.config.allowedDomain} accounts are allowed`,
            );
            res.redirect(302, redirect.href);
            return;
        }

        const authorizationCode = await this.seal<CodeClaims>(
            'code',
            {
                client_id: authorize.client_id,
                redirect_uri: authorize.redirect_uri,
                code_challenge: authorize.code_challenge,
                scopes: authorize.scopes,
                resource: authorize.resource,
                email: email,
                google_refresh_token: tokens.refresh_token,
            },
            CODE_TTL,
        );
        redirect.searchParams.set('code', authorizationCode);
        redirect.searchParams.set('iss', this.config.publicUrl.href);
        res.redirect(302, redirect.href);
    }

    public async challengeForAuthorizationCode(
        client: OAuthClientInformationFull,
        authorizationCode: string,
    ): Promise<string> {
        return (await this.openCode(client, authorizationCode)).code_challenge;
    }

    public async exchangeAuthorizationCode(
        client: OAuthClientInformationFull,
        authorizationCode: string,
        _codeVerifier?: string,
        redirectUri?: string,
        resource?: URL,
    ): Promise<OAuthTokens> {
        const code = await this.openCode(client, authorizationCode);
        if (redirectUri !== undefined && redirectUri !== code.redirect_uri) {
            throw new InvalidGrantError('redirect_uri does not match the authorization request');
        }
        if (resource !== undefined && this.checkResource(resource) !== code.resource) {
            throw new InvalidGrantError('resource does not match the authorization request');
        }
        this.markCodeUsed(authorizationCode);
        return this.issueTokens(client.client_id, code.scopes, code.resource, code.email, code.google_refresh_token);
    }

    public async exchangeRefreshToken(
        client: OAuthClientInformationFull,
        refreshToken: string,
        scopes?: string[],
        resource?: URL,
    ): Promise<OAuthTokens> {
        const claims = await this.open<RefreshClaims>('refresh', refreshToken).catch(() => {
            throw new InvalidGrantError('Invalid refresh token');
        });
        if (claims.client_id !== client.client_id) {
            throw new InvalidGrantError('Refresh token was issued to another client');
        }
        if (resource !== undefined && this.checkResource(resource) !== claims.resource) {
            throw new InvalidGrantError('resource does not match the original grant');
        }
        if (scopes && scopes.some((scope) => !claims.scopes.includes(scope))) {
            throw new InvalidGrantError('Requested scopes exceed the original grant');
        }

        // Fails when the Google account was disabled or the access was revoked.
        const tokens = await this.googleToken({
            grant_type: 'refresh_token',
            refresh_token: claims.google_refresh_token,
        });
        if (!tokens || (tokens.id_token !== undefined && !(await this.allowedEmail(tokens.id_token)))) {
            throw new InvalidGrantError('The Google account is no longer allowed');
        }
        return this.issueTokens(
            client.client_id,
            scopes ?? claims.scopes,
            claims.resource,
            claims.email,
            tokens.refresh_token ?? claims.google_refresh_token,
        );
    }

    public async verifyAccessToken(token: string): Promise<AuthInfo> {
        const claims = await this.open<AccessClaims & JWTPayload>('access', token).catch(() => {
            throw new InvalidTokenError('Invalid access token');
        });
        return {
            token: token,
            clientId: claims.client_id,
            scopes: claims.scopes,
            expiresAt: claims.exp,
            resource: new URL(claims.resource),
            extra: { email: claims.email },
        };
    }

    private async issueTokens(
        clientId: string,
        scopes: string[],
        resource: string,
        email: string,
        googleRefreshToken?: string,
    ): Promise<OAuthTokens> {
        const accessToken = await this.seal<AccessClaims>(
            'access',
            { client_id: clientId, scopes: scopes, resource: resource, email: email },
            ACCESS_TOKEN_TTL,
        );
        const tokens: OAuthTokens = { access_token: accessToken, token_type: 'Bearer', expires_in: ACCESS_TOKEN_TTL };
        if (scopes.length > 0) {
            tokens.scope = scopes.join(' ');
        }
        // Without a Google refresh token the client signs in again after an hour.
        if (googleRefreshToken) {
            tokens.refresh_token = await this.seal<RefreshClaims>(
                'refresh',
                {
                    client_id: clientId,
                    scopes: scopes,
                    resource: resource,
                    email: email,
                    google_refresh_token: googleRefreshToken,
                },
                REFRESH_TOKEN_TTL,
            );
        }
        return tokens;
    }

    private async openCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<CodeClaims> {
        const code = await this.open<CodeClaims>('code', authorizationCode).catch(() => {
            throw new InvalidGrantError('Invalid or expired authorization code');
        });
        if (code.client_id !== client.client_id) {
            throw new InvalidGrantError('Authorization code was issued to another client');
        }
        if (this.usedCodes.has(authorizationCode)) {
            throw new InvalidGrantError('Authorization code was already used');
        }
        return code;
    }

    private markCodeUsed(authorizationCode: string): void {
        const now = Date.now();
        for (const [code, expiresAt] of this.usedCodes) {
            if (expiresAt < now) {
                this.usedCodes.delete(code);
            }
        }
        this.usedCodes.set(authorizationCode, now + CODE_TTL * 1000);
    }

    // Only tokens for this MCP server are issued (RFC 8707).
    private checkResource(resource: URL | undefined): string {
        if (resource !== undefined && resource.href.replace(/\/$/, '') !== this.resourceUrl.href) {
            throw new InvalidTargetError(`Unknown resource ${resource.href}`);
        }
        return this.resourceUrl.href;
    }

    private async googleToken(params: Record<string, string>): Promise<GoogleTokenResponse | undefined> {
        const response = await fetch(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                ...params,
                client_id: this.config.googleClientId,
                client_secret: this.config.googleClientSecret,
            }),
        });
        if (!response.ok) {
            console.warn(`Google token request failed with status ${response.status}`);
            return undefined;
        }
        return (await response.json()) as GoogleTokenResponse;
    }

    // Returns the email of a verified account of the allowed domain, otherwise undefined.
    private async allowedEmail(idToken: string | undefined): Promise<string | undefined> {
        if (!idToken) {
            return undefined;
        }
        try {
            const { payload } = await jwtVerify(idToken, this.googleKeys, {
                issuer: ['https://accounts.google.com', 'accounts.google.com'],
                audience: this.config.googleClientId,
            });
            const allowed = payload['hd'] === this.config.allowedDomain && payload['email_verified'] === true;
            return allowed && typeof payload['email'] === 'string' ? payload['email'] : undefined;
        } catch {
            return undefined;
        }
    }

    private async seal<T extends object>(kind: TokenKind, claims: T, ttlSeconds?: number): Promise<string> {
        const jwt = new EncryptJWT({ ...claims } as JWTPayload)
            .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
            .setIssuer(this.config.publicUrl.href)
            .setAudience(kind)
            .setIssuedAt();
        if (ttlSeconds !== undefined) {
            jwt.setExpirationTime(`${ttlSeconds}s`);
        }
        return jwt.encrypt(this.config.tokenKey);
    }

    private async open<T>(kind: TokenKind, token: string): Promise<T> {
        const { payload } = await jwtDecrypt(token, this.config.tokenKey, {
            issuer: this.config.publicUrl.href,
            audience: kind,
        });
        return payload as T;
    }
}

export function isAllowedRedirectUri(uri: string): boolean {
    if (ALLOWED_REDIRECT_URIS.includes(uri)) {
        return true;
    }
    try {
        const url = new URL(uri);
        return url.protocol === 'http:' && LOOPBACK_HOSTS.includes(url.hostname);
    } catch {
        return false;
    }
}

function readCookie(req: Request, name: string): string | undefined {
    for (const part of (req.headers.cookie ?? '').split(';')) {
        const [key, ...value] = part.trim().split('=');
        if (key === name) {
            return decodeURIComponent(value.join('='));
        }
    }
    return undefined;
}

function safeEqual(a: string, b: string): boolean {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}
