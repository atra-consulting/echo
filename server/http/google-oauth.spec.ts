// End-to-end test of the OAuth flow over HTTP, with Google's token endpoint
// replaced by a fake that returns ID tokens signed with a test key.
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { Server, createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { after, before, beforeEach, describe, it } from 'node:test';
import { CryptoKey, JWTPayload, SignJWT, generateKeyPair } from 'jose';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { bundledTextModules } from '../adapters/bundled-text-modules';
import { createApp } from './app';

const GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
const DOMAIN = 'example.org';
const REDIRECT_URI = 'http://localhost:9999/callback';

interface GoogleFake {
    claims: JWTPayload;
    refreshFails: boolean;
}

describe('OAuth with Google', () => {
    const realFetch = globalThis.fetch;
    const google: GoogleFake = { claims: {}, refreshFails: false };
    let privateKey: CryptoKey;
    let server: Server;
    let baseUrl: string;

    before(async () => {
        const keys = await generateKeyPair('RS256');
        privateKey = keys.privateKey;

        globalThis.fetch = async (input, init) => {
            if (String(input) !== 'https://oauth2.googleapis.com/token') {
                return realFetch(input, init);
            }
            const params = new URLSearchParams(String(init?.body));
            if (params.get('grant_type') === 'refresh_token' && google.refreshFails) {
                return Response.json({ error: 'invalid_grant' }, { status: 400 });
            }
            const idToken = await new SignJWT(google.claims)
                .setProtectedHeader({ alg: 'RS256' })
                .setIssuer('https://accounts.google.com')
                .setAudience(GOOGLE_CLIENT_ID)
                .setExpirationTime('5m')
                .sign(privateKey);
            return Response.json({ id_token: idToken, refresh_token: 'google-refresh-token' });
        };

        // The public URL contains the port, so the app is attached after listen.
        server = createServer();
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
        const app = createApp({
            host: '127.0.0.1',
            publicUrl: new URL(baseUrl),
            textModules: bundledTextModules,
            mcpAuth: 'google',
            google: {
                googleClientId: GOOGLE_CLIENT_ID,
                googleClientSecret: 'secret',
                allowedDomain: DOMAIN,
                tokenKey: new Uint8Array(randomBytes(32)),
                googleKeys: async () => keys.publicKey,
            },
        });
        server.on('request', app);
    });

    after(() => {
        globalThis.fetch = realFetch;
        server.close();
    });

    beforeEach(() => {
        google.claims = { email: `anna.muster@${DOMAIN}`, email_verified: true, hd: DOMAIN };
        google.refreshFails = false;
    });

    async function register(redirectUri = REDIRECT_URI): Promise<Response> {
        return fetch(`${baseUrl}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                redirect_uris: [redirectUri],
                client_name: 'Test',
                token_endpoint_auth_method: 'none',
            }),
        });
    }

    // Runs the browser part of the flow and returns the redirect to the client.
    async function signIn(clientId: string, verifier: string, withCookie = true): Promise<Response> {
        const authorize = new URL(`${baseUrl}/authorize`);
        authorize.search = new URLSearchParams({
            client_id: clientId,
            redirect_uri: REDIRECT_URI,
            response_type: 'code',
            code_challenge: createHash('sha256').update(verifier).digest('base64url'),
            code_challenge_method: 'S256',
            state: 'client-state',
            resource: `${baseUrl}/mcp`,
        }).toString();
        const toGoogle = await fetch(authorize, { redirect: 'manual' });
        assert.equal(toGoogle.status, 302);
        const googleUrl = new URL(toGoogle.headers.get('location')!);
        assert.equal(googleUrl.origin, 'https://accounts.google.com');
        assert.equal(googleUrl.searchParams.get('hd'), DOMAIN);

        const callback = new URL(`${baseUrl}/oauth/google/callback`);
        callback.searchParams.set('state', googleUrl.searchParams.get('state')!);
        callback.searchParams.set('code', 'google-code');
        const cookie = toGoogle.headers.get('set-cookie')!.split(';')[0];
        return fetch(callback, { redirect: 'manual', headers: withCookie ? { cookie } : {} });
    }

    async function token(params: Record<string, string>): Promise<Response> {
        return fetch(`${baseUrl}/token`, { method: 'POST', body: new URLSearchParams(params) });
    }

    async function authorizationCode(clientId: string, verifier: string): Promise<string> {
        const redirect = new URL((await signIn(clientId, verifier)).headers.get('location')!);
        assert.equal(redirect.searchParams.get('state'), 'client-state');
        return redirect.searchParams.get('code')!;
    }

    async function clientId(): Promise<string> {
        return ((await (await register()).json()) as { client_id: string }).client_id;
    }

    it('advertises the protected resource and rejects requests without a token', async () => {
        const metadata = await (await fetch(`${baseUrl}/.well-known/oauth-protected-resource/mcp`)).json();
        assert.equal(metadata.resource, `${baseUrl}/mcp`);

        const response = await fetch(`${baseUrl}/mcp`, { method: 'POST' });
        assert.equal(response.status, 401);
        assert.match(response.headers.get('www-authenticate')!, /resource_metadata=/);
    });

    it('only registers allowed redirect URIs', async () => {
        assert.equal((await register('https://attacker.example/callback')).status, 400);
        const response = await register();
        assert.equal(response.status, 201);
        const client = await response.json();
        assert.equal(client.token_endpoint_auth_method, 'none');
        assert.equal(client.client_secret, undefined);
    });

    it('signs in with Google and gives access to the MCP tools', async () => {
        const id = await clientId();
        const verifier = randomBytes(32).toString('base64url');
        const code = await authorizationCode(id, verifier);

        const response = await token({
            grant_type: 'authorization_code',
            client_id: id,
            code: code,
            code_verifier: verifier,
            redirect_uri: REDIRECT_URI,
            resource: `${baseUrl}/mcp`,
        });
        assert.equal(response.status, 200);
        const tokens = await response.json();
        assert.ok(tokens.refresh_token);

        const client = new Client({ name: 'test', version: '0.0.0' });
        await client.connect(
            new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
                requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } },
            }),
        );
        const { tools } = await client.listTools();
        assert.equal(tools.length, 8);
        await client.close();

        const replay = await token({ grant_type: 'authorization_code', client_id: id, code, code_verifier: verifier });
        assert.equal(replay.status, 400);
    });

    it('rejects a wrong PKCE verifier', async () => {
        const id = await clientId();
        const code = await authorizationCode(id, randomBytes(32).toString('base64url'));
        const response = await token({
            grant_type: 'authorization_code',
            client_id: id,
            code,
            code_verifier: 'x'.repeat(43),
        });
        assert.equal(response.status, 400);
    });

    it('rejects accounts of other domains and unverified accounts', async () => {
        const id = await clientId();
        for (const claims of [
            { email: 'anna@example.com', email_verified: true, hd: 'example.com' },
            { email: 'anna@example.com', email_verified: true },
            { email: `anna@${DOMAIN}`, email_verified: false, hd: DOMAIN },
        ]) {
            google.claims = claims;
            const redirect = new URL((await signIn(id, 'v'.repeat(43))).headers.get('location')!);
            assert.equal(redirect.searchParams.get('error'), 'access_denied');
            assert.equal(redirect.searchParams.get('code'), null);
        }
    });

    it('rejects a callback from another browser', async () => {
        const response = await signIn(await clientId(), 'v'.repeat(43), false);
        assert.equal(response.status, 400);
    });

    it('refreshes tokens only while Google still accepts the account', async () => {
        const id = await clientId();
        const verifier = randomBytes(32).toString('base64url');
        const code = await authorizationCode(id, verifier);
        const tokens = await (
            await token({ grant_type: 'authorization_code', client_id: id, code, code_verifier: verifier })
        ).json();

        const refreshed = await token({
            grant_type: 'refresh_token',
            client_id: id,
            refresh_token: tokens.refresh_token,
        });
        assert.equal(refreshed.status, 200);

        google.refreshFails = true;
        const rejected = await token({
            grant_type: 'refresh_token',
            client_id: id,
            refresh_token: tokens.refresh_token,
        });
        assert.equal(rejected.status, 400);

        const otherClient = await clientId();
        google.refreshFails = false;
        const foreign = await token({
            grant_type: 'refresh_token',
            client_id: otherClient,
            refresh_token: tokens.refresh_token,
        });
        assert.equal(foreign.status, 400);
    });
});
