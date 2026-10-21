// Tests of the REST API over HTTP. Like the other specs they derive their
// selections from the steps, so they stay independent of the wording.
import assert from 'node:assert/strict';
import { Server, request } from 'node:http';
import { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { AppOptions, createApp } from './app';
import { bundledTextModules } from '../adapters/bundled-text-modules';
import { draft, start, stepBox } from '../core/steps';

async function startApp(options: Partial<AppOptions> = {}): Promise<{ server: Server; baseUrl: string }> {
    const app = createApp({
        host: '127.0.0.1',
        publicUrl: new URL('http://localhost'),
        textModules: bundledTextModules,
        mcpAuth: 'off',
        ...options,
    });
    const server = await new Promise<Server>((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    return { server, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

function stop(server: Server): Promise<void> {
    return new Promise((resolve) => server.close(() => resolve()));
}

function postJson(url: string, body: unknown): Promise<Response> {
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
}

describe('REST API', () => {
    let server: Server;
    let baseUrl: string;

    before(async () => ({ server, baseUrl } = await startApp()));
    after(() => stop(server));

    it('reports health and version', async () => {
        const res = await fetch(`${baseUrl}/api/health`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.status, 'ok');
        assert.equal(typeof body.version, 'string');
    });

    it('answers the health check for any Host, everything else only for allowed ones', async () => {
        // A startup probe may send the instance IP as Host; fetch cannot set Host, node:http can.
        const status = (path: string): Promise<number> =>
            new Promise((resolve, reject) => {
                const url = new URL(path, baseUrl);
                request(url, { headers: { Host: '10.1.2.3:8081' } }, (res) => {
                    res.resume();
                    resolve(res.statusCode ?? 0);
                })
                    .on('error', reject)
                    .end();
            });
        assert.equal(await status('/api/health'), 200);
        assert.equal(await status('/api/certificate-types'), 403);
    });

    it('lists the certificate types with the disclaimer', async () => {
        const body = await (await fetch(`${baseUrl}/api/certificate-types`)).json();
        assert.deepEqual(
            body.certificate_types.map((t: { id: string }) => t.id),
            ['abschlusszeugnis', 'zwischenzeugnis'],
        );
        assert.deepEqual(body.salutations, ['Herr', 'Frau']);
        assert.match(body.disclaimer, /keine Rechtsberatung/);
    });

    it('serves the text modules in the structure of the templates, per salutation', async () => {
        const male = await (await fetch(`${baseUrl}/api/certificate-types/zwischenzeugnis/text-modules`)).json();
        assert.deepEqual(male.textblocks, bundledTextModules.get('zwischenzeugnis').textblocks);
        assert.match(male.disclaimer, /keine Rechtsberatung/);

        const url = `${baseUrl}/api/certificate-types/zwischenzeugnis/text-modules?salutation=Frau`;
        const female = await (await fetch(url)).json();
        assert.equal(female.salutation, 'Frau');
        assert.deepEqual(female.textblocks, bundledTextModules.get('zwischenzeugnis', 'Frau').textblocks);
    });

    it('starts the workflow with the steps, the person fields and the first step', async () => {
        const url = `${baseUrl}/api/certificate-types/abschlusszeugnis/steps?salutation=Frau`;
        const body = await (await fetch(url)).json();
        assert.deepEqual(body, {
            certificate_type: 'abschlusszeugnis',
            salutation: 'Frau',
            ...start(bundledTextModules.get('abschlusszeugnis', 'Frau')),
            disclaimer: body.disclaimer,
        });
        assert.match(body.disclaimer, /keine Rechtsberatung/);
    });

    it('serves one step at a time', async () => {
        const textModules = bundledTextModules.get('zwischenzeugnis');
        const step = textModules.textblocks[2].name;
        const body = await (await fetch(`${baseUrl}/api/certificate-types/zwischenzeugnis/steps/${step}`)).json();
        assert.deepEqual(body, {
            certificate_type: 'zwischenzeugnis',
            salutation: 'Herr',
            ...stepBox(textModules, step),
            disclaimer: body.disclaimer,
        });
    });

    it('rejects unknown certificate types, steps and salutations', async () => {
        const type = await fetch(`${baseUrl}/api/certificate-types/arbeitsvertrag/steps`);
        assert.equal(type.status, 404);
        assert.equal((await type.json()).error.code, 'unknown_certificate_type');

        const step = await fetch(`${baseUrl}/api/certificate-types/abschlusszeugnis/steps/unknown`);
        assert.equal(step.status, 404);
        assert.ok((await step.json()).error.details.allowed.includes('intro'));

        const salutation = await fetch(`${baseUrl}/api/certificate-types/abschlusszeugnis/steps?salutation=Divers`);
        assert.equal(salutation.status, 400);
        assert.equal((await salutation.json()).error.code, 'invalid_request');
    });

    it('composes partial selections like the core and never caches them', async () => {
        const textModules = bundledTextModules.get('abschlusszeugnis', 'Frau');
        const first = stepBox(textModules, textModules.textblocks[0].name)!;
        const selections = [{ step: first.step, sentence: 0 }];
        const formData = { salutation: 'Frau' as const, firstname: 'Anna', lastname: 'Muster' };

        const res = await postJson(`${baseUrl}/api/references`, {
            certificate_type: 'abschlusszeugnis',
            form_data: formData,
            selections: selections,
        });
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('cache-control'), 'no-store');
        const body = await res.json();
        assert.deepEqual(body, { ...draft(textModules, selections, formData), disclaimer: body.disclaimer });
        assert.equal(body.next_step, first.next_step);
        assert.match(body.disclaimer, /keine Rechtsberatung/);
    });

    it('reports schema errors with 400 and selection problems with 422', async () => {
        const schema = await postJson(`${baseUrl}/api/references`, { certificate_type: 'abschlusszeugnis' });
        assert.equal(schema.status, 400);
        const paths = (await schema.json()).error.details.map((d: { path: string }) => d.path);
        assert.ok(paths.includes('form_data') && paths.includes('selections'));

        const selection = await postJson(`${baseUrl}/api/references`, {
            certificate_type: 'abschlusszeugnis',
            form_data: {},
            selections: [{ step: 'intro', sentence: 999 }],
        });
        assert.equal(selection.status, 422);
        assert.match((await selection.json()).error.details[0], /Satz 999/);
    });

    it('answers malformed JSON without logging the body', async (t) => {
        const errors = t.mock.method(console, 'error', () => undefined);
        const res = await postJson(`${baseUrl}/api/references`, '{"form_data": {"lastname": "Geheim"');
        assert.equal(res.status, 400);
        assert.equal((await res.json()).error.code, 'bad_request');
        assert.ok(errors.mock.calls.every((call) => !JSON.stringify(call.arguments).includes('Geheim')));
    });

    it('publishes an OpenAPI description', async () => {
        const doc = await (await fetch(`${baseUrl}/api/openapi.json`)).json();
        assert.equal(doc.openapi, '3.1.0');
        assert.ok(doc.paths['/api/references'].post);
        assert.ok(doc.paths['/api/certificate-types/{type}/steps/{step}'].get);
        assert.ok(doc.components.schemas.ReferenceDraft.properties.selections);
        assert.match(doc.info.description, /keine Rechtsberatung/);
    });

    it('answers unknown API paths with 404 JSON and has no /mcp when MCP is off', async () => {
        const api = await fetch(`${baseUrl}/api/unknown`);
        assert.equal(api.status, 404);
        assert.equal((await api.json()).error.code, 'not_found');

        const mcp = await postJson(`${baseUrl}/mcp`, {});
        assert.equal(mcp.status, 404);

        const drafts = await fetch(`${baseUrl}/api/drafts`);
        assert.equal(drafts.status, 404);
        assert.equal((await drafts.json()).error.code, 'drafts_disabled');
    });
});

describe('MCP without authentication of its own', () => {
    it('serves the tools under /mcp', async () => {
        const { server, baseUrl } = await startApp({ mcpAuth: 'none' });
        const client = new Client({ name: 'test', version: '0.0.0' });
        try {
            await client.connect(new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`)));
            const { tools } = await client.listTools();
            assert.ok(tools.some((t) => t.name === 'create_draft'));
        } finally {
            await client.close();
            await stop(server);
        }
    });
});
