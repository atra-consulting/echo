// REST endpoints of the drafts over HTTP, with two users signed in through
// IAP assertions signed by a test key.
import assert from 'node:assert/strict';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { CryptoKey, SignJWT, generateKeyPair } from 'jose';
import { AppOptions, createApp } from './app';
import { Keyring } from '../adapters/aes-gcm-cipher';
import { bundledTextModules } from '../adapters/bundled-text-modules';
import { FixedIdentityProvider, IAP_HEADER, IapIdentityProvider } from '../adapters/iap-identity';
import { MemoryDraftStore } from '../adapters/memory-draft-store';
import { DraftService } from '../core/drafts';

const AUDIENCE = '/projects/123/locations/europe-west1/services/zeugnisgenerator';
const DAY = 24 * 60 * 60 * 1000;
const FIRST_STEP = bundledTextModules.get('zwischenzeugnis').textblocks[0].name;

async function listen(options: AppOptions): Promise<{ server: Server; baseUrl: string }> {
    const app = createApp(options);
    const server = await new Promise<Server>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    return { server, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

describe('drafts API', () => {
    let privateKey: CryptoKey;
    let server: Server;
    let baseUrl: string;
    let now = Date.UTC(2026, 9, 1);

    before(async () => {
        const keys = await generateKeyPair('ES256');
        privateKey = keys.privateKey;
        const service = new DraftService(new MemoryDraftStore(), Keyring.ephemeral(), bundledTextModules, {
            retentionDays: 90,
            clock: () => new Date(now),
        });
        ({ server, baseUrl } = await listen({
            host: '127.0.0.1',
            publicUrl: new URL('http://localhost'),
            textModules: bundledTextModules,
            mcpAuth: 'off',
            identity: new IapIdentityProvider(AUDIENCE, async () => keys.publicKey),
            requireIdentity: true,
            drafts: service,
        }));
    });

    after(() => new Promise<void>((resolve) => server.close(() => resolve())));

    async function as(user: string, method: string, path: string, body?: unknown): Promise<Response> {
        const assertion = await new SignJWT({ email: `accounts.google.com:${user}` })
            .setProtectedHeader({ alg: 'ES256' })
            .setIssuer('https://cloud.google.com/iap')
            .setAudience(AUDIENCE)
            .setSubject(`accounts.google.com:${user}`)
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(privateKey);
        return fetch(`${baseUrl}/api/drafts${path}`, {
            method: method,
            headers: { [IAP_HEADER]: assertion, 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    }

    async function create(user: string): Promise<{ id: string } & Record<string, unknown>> {
        const res = await as(user, 'POST', '', {
            certificate_type: 'zwischenzeugnis',
            form_data: { salutation: 'Herr', lastname: 'Muster' },
        });
        assert.equal(res.status, 201);
        return res.json();
    }

    it('requires a verified user', async () => {
        assert.equal((await fetch(`${baseUrl}/api/drafts`)).status, 401);
    });

    it('creates, lists, reads and deletes the own drafts without caching', async () => {
        const draft = await create('a@example.com');
        const list = await as('a@example.com', 'GET', '');
        assert.equal(list.headers.get('cache-control'), 'no-store');
        const body = await list.json();
        assert.equal(body.retention_days, 90);
        assert.ok(body.drafts.some((d: { id: string }) => d.id === draft.id));

        const read = await (await as('a@example.com', 'GET', `/${draft.id}`)).json();
        assert.equal(read.result.next_step, FIRST_STEP);

        assert.equal((await as('a@example.com', 'DELETE', `/${draft.id}`)).status, 204);
        assert.equal((await as('a@example.com', 'GET', `/${draft.id}`)).status, 404);
    });

    it('answers 404 for drafts of others, never 403', async () => {
        const draft = await create('a@example.com');
        for (const [method, path, body] of [
            ['GET', `/${draft.id}`],
            ['PUT', `/${draft.id}`, { certificate_type: 'zwischenzeugnis', form_data: {}, selections: [] }],
            ['PATCH', `/${draft.id}`, { form_data: { lastname: 'X' } }],
            ['DELETE', `/${draft.id}`],
            ['POST', `/${draft.id}/finalize`],
            ['GET', `/${draft.id}/export`],
            ['GET', `/${draft.id}/steps/${FIRST_STEP}`],
        ] as [string, string, unknown?][]) {
            assert.equal((await as('b@example.com', method, path, body)).status, 404, `${method} ${path}`);
        }
        const list = await (await as('b@example.com', 'GET', '')).json();
        assert.ok(!list.drafts.some((d: { id: string }) => d.id === draft.id));
    });

    it('updates one step at a time and serves the step of the draft', async () => {
        const draft = await create('a@example.com');
        const res = await as('a@example.com', 'PATCH', `/${draft.id}`, {
            step: FIRST_STEP,
            selections: [{ sentence: 0 }],
        });
        assert.equal(res.status, 200);
        const view = await res.json();
        assert.notEqual(view.result.next_step, FIRST_STEP);
        assert.ok(view.result.text.includes('Muster'));

        const step = await (await as('a@example.com', 'GET', `/${draft.id}/steps/${FIRST_STEP}`)).json();
        assert.equal(step.draft_id, draft.id);
        assert.equal(step.current.status, 'complete');
        assert.equal(step.current.selected[0].sentence, 0);

        const invalid = await as('a@example.com', 'PATCH', `/${draft.id}`, {
            step: FIRST_STEP,
            selections: [{ sentence: 999 }],
        });
        assert.equal(invalid.status, 422);
        const unknown = await as('a@example.com', 'GET', `/${draft.id}/steps/unknown`);
        assert.equal(unknown.status, 404);
    });

    it('locks final drafts and round-trips export and import', async () => {
        const draft = await create('a@example.com');
        assert.equal((await (await as('a@example.com', 'POST', `/${draft.id}/finalize`)).json()).status, 'final');
        const put = await as('a@example.com', 'PUT', `/${draft.id}`, {
            certificate_type: 'zwischenzeugnis',
            form_data: {},
            selections: [],
        });
        assert.equal(put.status, 409);
        assert.equal((await as('a@example.com', 'PATCH', `/${draft.id}`, { form_data: {} })).status, 409);

        const exported = await as('a@example.com', 'GET', `/${draft.id}/export`);
        assert.match(exported.headers.get('content-disposition') ?? '', /attachment/);
        const data = await exported.json();
        assert.equal(data.status, 'final');
        assert.equal(data.schema_version, 1);
        assert.ok(data.exported_at);
        assert.ok(!JSON.stringify(data).includes('a@example.com') && !JSON.stringify(data).includes(draft.id));

        const imported = await as('b@example.com', 'POST', '/import', data);
        assert.equal(imported.status, 201);
        const copy = await imported.json();
        assert.equal(copy.status, 'draft');
        assert.deepEqual(copy.draft, (await (await as('a@example.com', 'GET', `/${draft.id}`)).json()).draft);
        const edit = await as('b@example.com', 'PATCH', `/${copy.id}`, { form_data: { lastname: 'Neu' } });
        assert.equal(edit.status, 200);

        const broken = await as('b@example.com', 'POST', '/import', { ...data, schema_version: 2 });
        assert.equal(broken.status, 400);
    });

    it('treats expired drafts as gone', async () => {
        const draft = await create('a@example.com');
        now += 91 * DAY;
        assert.equal((await as('a@example.com', 'GET', `/${draft.id}`)).status, 404);
    });
});

describe('drafts API without IAP', () => {
    it('uses the development user when one is configured', async () => {
        const service = new DraftService(new MemoryDraftStore(), Keyring.ephemeral(), bundledTextModules, {
            retentionDays: 90,
        });
        const { server, baseUrl } = await listen({
            host: '127.0.0.1',
            publicUrl: new URL('http://localhost'),
            textModules: bundledTextModules,
            mcpAuth: 'off',
            identity: new FixedIdentityProvider({ email: 'dev@example.com', subject: 'dev' }),
            drafts: service,
        });
        try {
            const res = await fetch(`${baseUrl}/api/drafts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ certificate_type: 'abschlusszeugnis' }),
            });
            assert.equal(res.status, 201);
            assert.equal((await service.list('dev@example.com')).length, 1);
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });
});
