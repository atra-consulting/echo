import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from './server';

describe('MCP server', () => {
    const client = new Client({ name: 'test', version: '0.0.0' });

    before(async () => {
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        await createMcpServer().connect(serverTransport);
        await client.connect(clientTransport);
    });

    after(() => client.close());

    it('offers read-only tools and instructions with the disclaimer', async () => {
        const { tools } = await client.listTools();
        assert.deepEqual(tools.map((t) => t.name).sort(), ['compose_reference', 'list_text_modules']);
        assert.ok(tools.every((t) => t.annotations?.readOnlyHint));
        assert.match(client.getInstructions() ?? '', /keine Rechtsberatung/);
    });

    it('lists the text modules of one topic', async () => {
        const result = await client.callTool({
            name: 'list_text_modules',
            arguments: { certificate_type: 'zwischenzeugnis', topic: 'intro' },
        });
        const content = JSON.parse((result.content as { text: string }[])[0].text);
        assert.deepEqual(
            content.topics.map((t: { topic: string }) => t.topic),
            ['intro'],
        );
        assert.ok(content.placeholders.some((p: { name: string }) => p.name === 'firstname'));
    });

    it('reports an unknown topic as tool error', async () => {
        const result = await client.callTool({
            name: 'list_text_modules',
            arguments: { certificate_type: 'zwischenzeugnis', topic: 'unknown' },
        });
        assert.equal(result.isError, true);
    });

    it('composes a reference', async () => {
        const result = await client.callTool({
            name: 'compose_reference',
            arguments: {
                certificate_type: 'abschlusszeugnis',
                form_data: { salutation: 'Frau', firstname: 'Anna', lastname: 'Muster' },
                selections: [{ topic: 'intro', sentence: 0 }],
            },
        });
        const content = result.structuredContent as {
            text: string;
            missing_placeholders: unknown[];
            disclaimer: string;
        };
        assert.ok(content.text.includes('Anna'));
        assert.ok(Array.isArray(content.missing_placeholders));
        assert.match(content.disclaimer, /keine Rechtsberatung/);
    });

    it('reports an invalid selection as tool error', async () => {
        const result = await client.callTool({
            name: 'compose_reference',
            arguments: {
                certificate_type: 'abschlusszeugnis',
                form_data: {},
                selections: [{ topic: 'intro', sentence: 999 }],
            },
        });
        assert.equal(result.isError, true);
        assert.match((result.content as { text: string }[])[0].text, /Satz 999/);
    });
});
