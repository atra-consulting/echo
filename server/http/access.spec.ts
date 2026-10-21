// Access to /api and /mcp behind IAP: the identity is required, except for the health check.
import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { CryptoKey, SignJWT, generateKeyPair } from 'jose';
import { bundledTextModules } from '../adapters/bundled-text-modules';
import { IAP_HEADER, IapIdentityProvider } from '../adapters/iap-identity';
import { createApp } from './app';

const AUDIENCE = '/projects/123/locations/europe-west1/services/zeugnisgenerator';

describe('access behind IAP', () => {
    let privateKey: CryptoKey;
    let server: Server;
    let baseUrl: string;

    before(async () => {
        const keys = await generateKeyPair('ES256');
        privateKey = keys.privateKey;
        const app = createApp({
            host: '127.0.0.1',
            publicUrl: new URL('http://localhost'),
            textModules: bundledTextModules,
            mcpAuth: 'none',
            identity: new IapIdentityProvider(AUDIENCE, async () => keys.publicKey),
            requireIdentity: true,
        });
        server = await new Promise<Server>((resolve) => {
            const s = app.listen(0, '127.0.0.1', () => resolve(s));
        });
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    after(() => new Promise<void>((resolve) => server.close(() => resolve())));

    async function assertion(): Promise<string> {
        return new SignJWT({ email: 'accounts.google.com:someone@example.com' })
            .setProtectedHeader({ alg: 'ES256' })
            .setIssuer('https://cloud.google.com/iap')
            .setAudience(AUDIENCE)
            .setSubject('accounts.google.com:1234')
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(privateKey);
    }

    it('lets the health check through without assertion', async () => {
        assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
    });

    it('requires a valid assertion for the API', async () => {
        assert.equal((await fetch(`${baseUrl}/api/certificate-types`)).status, 401);
        const headers = { [IAP_HEADER]: await assertion() };
        assert.equal((await fetch(`${baseUrl}/api/certificate-types`, { headers })).status, 200);
    });

    it('requires a valid assertion for /mcp without authentication of its own', async () => {
        const res = await fetch(`${baseUrl}/mcp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
        });
        assert.equal(res.status, 401);
    });
});
