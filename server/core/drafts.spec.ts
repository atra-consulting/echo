// The draft use cases against in-memory adapters.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bundledTextModules } from '../adapters/bundled-text-modules';
import { MemoryDraftStore } from '../adapters/memory-draft-store';
import { DraftConflictError, DraftFinalError, DraftNotFoundError, DraftService } from './drafts';
import { ReferenceDraft } from './schemas';
import { SelectionError } from './text-modules';

const DAY = 24 * 60 * 60 * 1000;

function intro(): ReferenceDraft {
    return {
        certificate_type: 'abschlusszeugnis',
        form_data: { salutation: 'Frau', firstname: 'Anna', lastname: 'Muster' },
        selections: [{ step: bundledTextModules.get('abschlusszeugnis').textblocks[0].name, sentence: 0 }],
    };
}

describe('drafts', () => {
    let now = Date.UTC(2026, 9, 1);
    const store = new MemoryDraftStore();
    const service = new DraftService(store, bundledTextModules, {
        retentionDays: 90,
        clock: () => new Date(now),
    });

    it('creates a draft with an unguessable id and composes its text', async () => {
        const view = await service.create('a@example.com', intro());
        const stored = await store.get(view.id);
        assert.equal(stored?.owner, 'a@example.com');
        assert.equal(stored?.revision, 1);
        assert.equal(view.title, 'Anna Muster');
        assert.ok(view.result.text.includes('Muster'));
        assert.match(view.id, /^[A-Za-z0-9_-]{24}$/);
    });

    it('validates selections before storing anything', async () => {
        const bad = { ...intro(), selections: [{ step: 'intro', sentence: 999 }] };
        await assert.rejects(service.create('a@example.com', bad), SelectionError);
    });

    it('keeps drafts to their owner', async () => {
        const view = await service.create('a@example.com', intro());
        await assert.rejects(service.get('b@example.com', view.id), DraftNotFoundError);
        await assert.rejects(service.delete('b@example.com', view.id), DraftNotFoundError);
        assert.ok(!(await service.list('b@example.com')).some((d) => d.id === view.id));
    });

    it('replaces the selections of one step and merges person fields', async () => {
        const view = await service.create('a@example.com', intro());
        const updated = await service.update('a@example.com', view.id, {
            form_data: { firstname: '', job_title: 'Entwicklerin' },
            step: 'intro',
            selections: [{ sentence: 1 }],
        });
        assert.deepEqual(updated.draft.selections, [{ step: 'intro', sentence: 1 }]);
        assert.equal(updated.draft.form_data['firstname'], undefined);
        assert.equal(updated.draft.form_data['job_title'], 'Entwicklerin');
    });

    it('locks final drafts and exports them for a new import', async () => {
        const view = await service.create('a@example.com', intro());
        const final = await service.finalize('a@example.com', view.id);
        assert.equal(final.status, 'final');
        await assert.rejects(service.replace('a@example.com', view.id, intro()), DraftFinalError);
        await assert.rejects(service.update('a@example.com', view.id, { form_data: {} }), DraftFinalError);

        const exported = await service.export('a@example.com', view.id);
        assert.equal(exported.status, 'final');
        assert.ok(!JSON.stringify(exported).includes('a@example.com'));
        assert.ok(!JSON.stringify(exported).includes(view.id));

        const imported = await service.import('b@example.com', exported);
        assert.equal(imported.status, 'draft');
        assert.notEqual(imported.id, view.id);
        assert.deepEqual(imported.draft, view.draft);
        assert.equal(imported.result.text, view.result.text);
    });

    it('refreshes the expiry on writes only and treats expired drafts as gone', async () => {
        const view = await service.create('a@example.com', intro());
        assert.equal(Date.parse(view.expire_at), now + 90 * DAY);

        now += 30 * DAY;
        await service.get('a@example.com', view.id);
        assert.equal(Date.parse((await service.get('a@example.com', view.id)).expire_at), now - 30 * DAY + 90 * DAY);
        const updated = await service.update('a@example.com', view.id, { form_data: { birthplace: 'Köln' } });
        assert.equal(Date.parse(updated.expire_at), now + 90 * DAY);

        now += 90 * DAY;
        await assert.rejects(service.get('a@example.com', view.id), DraftNotFoundError);
        assert.ok(!(await service.list('a@example.com')).some((d) => d.id === view.id));
        // Still in the store until the TTL deletion runs.
        assert.ok(await store.get(view.id));
    });

    it('never loses an update that races a finalize', async () => {
        const view = await service.create('a@example.com', intro());
        const [finalize, update] = await Promise.allSettled([
            service.finalize('a@example.com', view.id),
            service.update('a@example.com', view.id, { form_data: { birthplace: 'Köln' } }),
        ]);
        for (const result of [finalize, update]) {
            if (result.status === 'rejected') {
                assert.ok(result.reason instanceof DraftConflictError || result.reason instanceof DraftFinalError);
            }
        }
        const stored = await service.get('a@example.com', view.id);
        if (update.status === 'fulfilled') {
            // Applied, so it is in the stored draft, final or not.
            assert.equal(stored.draft.form_data['birthplace'], 'Köln');
        }
        if (finalize.status === 'fulfilled') {
            assert.equal(stored.status, 'final');
        }
        assert.equal(stored.revision, 1 + [finalize, update].filter((r) => r.status === 'fulfilled').length);
    });
});
