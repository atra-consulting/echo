import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { bundledTextModules } from '../adapters/bundled-text-modules';
import { MemoryDraftStore } from '../adapters/memory-draft-store';
import { DraftService, DraftView } from '../core/drafts';
import { Start } from '../core/steps';
import { createMcpServer } from './mcp-server';

type Result = Awaited<ReturnType<Client['callTool']>>;

function content<T>(result: Result): T {
    assert.notEqual(result.isError, true, JSON.stringify(result.content));
    return JSON.parse((result.content as { text: string }[])[0].text) as T;
}

async function connect(server: ReturnType<typeof createMcpServer>): Promise<Client> {
    const client = new Client({ name: 'test', version: '0.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return client;
}

describe('MCP server', () => {
    const service = new DraftService(new MemoryDraftStore(), bundledTextModules, {
        retentionDays: 90,
    });
    const textModules = bundledTextModules;
    let client: Client;

    before(async () => {
        client = await connect(createMcpServer({ textModules, drafts: service, owner: 'a@example.com' }));
    });

    after(() => client.close());

    const call = (name: string, args: Record<string, unknown> = {}): Promise<Result> =>
        client.callTool({ name, arguments: args });

    it('offers the tools of the draft workflow and instructions with the disclaimer', async () => {
        const { tools } = await client.listTools();
        assert.deepEqual(tools.map((t) => t.name).sort(), [
            'create_draft',
            'export_draft',
            'finalize_draft',
            'get_draft',
            'get_step',
            'import_draft',
            'list_drafts',
            'update_draft',
        ]);
        const instructions = client.getInstructions() ?? '';
        assert.match(instructions, /keine Rechtsberatung/);
        assert.match(instructions, /create_draft.*update_draft.*get_step.*finalize_draft/s);
        assert.match(instructions, /90 Tage/);
    });

    it('offers a prompt that starts the guided workflow', async () => {
        const prompt = await client.getPrompt({
            name: 'zeugnis_erstellen',
            arguments: { certificate_type: 'zwischenzeugnis' },
        });
        const text = (prompt.messages[0].content as { text: string }).text;
        assert.match(text, /zwischenzeugnis/);
        assert.match(text, /create_draft/);
    });

    it('walks through the steps one box at a time and keeps the draft', async () => {
        const created = content<DraftView & Start>(
            await call('create_draft', {
                certificate_type: 'zwischenzeugnis',
                form_data: { salutation: 'Herr', lastname: 'Muster' },
            }),
        );
        const first = created.first_step!;
        assert.equal(created.result.next_step, first.step);

        const updated = content<DraftView>(
            await call('update_draft', { draft_id: created.id, step: first.step, selections: [{ sentence: 0 }] }),
        );
        assert.equal(updated.result.next_step, first.next_step);
        assert.ok(updated.result.text.includes('Muster'));

        const next = content<{ step: string; current: { status: string } }>(
            await call('get_step', { draft_id: created.id, step: updated.result.next_step }),
        );
        assert.equal(next.current.status, 'open');

        const current = content<DraftView>(await call('get_draft', { draft_id: created.id }));
        assert.equal(current.result.steps[0].selected?.[0].sentence, 0);

        const list = content<{ drafts: { id: string }[] }>(await call('list_drafts'));
        assert.ok(list.drafts.some((d) => d.id === created.id));
    });

    it('finalizes, exports and imports a draft', async () => {
        const created = content<DraftView>(await call('create_draft', { certificate_type: 'abschlusszeugnis' }));
        content(await call('finalize_draft', { draft_id: created.id }));
        const locked = await call('update_draft', { draft_id: created.id, form_data: { lastname: 'X' } });
        assert.equal(locked.isError, true);

        const exported = content<Record<string, unknown>>(await call('export_draft', { draft_id: created.id }));
        delete exported['disclaimer'];
        const imported = content<DraftView>(await call('import_draft', { data: exported }));
        assert.equal(imported.status, 'draft');
        assert.notEqual(imported.id, created.id);
    });

    it('reports unknown drafts, steps and invalid selections as tool errors', async () => {
        assert.equal((await call('get_draft', { draft_id: 'unknown' })).isError, true);
        const created = content<DraftView>(await call('create_draft', { certificate_type: 'abschlusszeugnis' }));
        assert.equal((await call('get_step', { draft_id: created.id, step: 'unknown' })).isError, true);
        const invalid = await call('update_draft', {
            draft_id: created.id,
            step: 'intro',
            selections: [{ sentence: 999 }],
        });
        assert.equal(invalid.isError, true);
        assert.match((invalid.content as { text: string }[])[0].text, /Satz 999/);
    });

    it('keeps drafts of other users out of reach', async () => {
        const created = content<DraftView>(await call('create_draft', { certificate_type: 'abschlusszeugnis' }));
        const other = await connect(createMcpServer({ textModules, drafts: service, owner: 'b@example.com' }));
        try {
            assert.equal(
                (await other.callTool({ name: 'get_draft', arguments: { draft_id: created.id } })).isError,
                true,
            );
        } finally {
            await other.close();
        }
    });

    it('answers without drafts when no user is signed in', async () => {
        const anonymous = await connect(createMcpServer({ textModules, drafts: service }));
        try {
            assert.equal((await anonymous.callTool({ name: 'list_drafts', arguments: {} })).isError, true);
        } finally {
            await anonymous.close();
        }
    });
});
