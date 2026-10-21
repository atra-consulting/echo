// Contract every DraftStore adapter must pass: memory always, Firestore when
// FIRESTORE_EMULATOR_HOST points to an emulator (e.g. in compose.yaml or
// "gcloud emulators firestore start").
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DraftConflictError, DraftStore, StoredDraft } from '../core/ports';
import { Keyring } from './aes-gcm-cipher';
import { FirestoreDraftStore } from './firestore-draft-store';
import { MemoryDraftStore } from './memory-draft-store';

const DAY = 24 * 60 * 60 * 1000;

function record(id: string, owner: string, updatedAt: number, revision = 1): StoredDraft {
    return {
        id,
        owner,
        status: 'draft',
        schemaVersion: 1,
        revision,
        reference: {
            schema_version: 1,
            certificate_type: 'zwischenzeugnis',
            form_data: { salutation: 'Frau', firstname: 'Anna', lastname: 'Muster' },
            selections: [{ step: 'intro', sentence: 0 }],
        },
        createdAt: new Date(updatedAt),
        updatedAt: new Date(updatedAt),
        expireAt: new Date(updatedAt + 90 * DAY),
    };
}

function contract(name: string, create: () => DraftStore): void {
    describe(`draft store contract: ${name}`, () => {
        const run = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        it('saves, reads, replaces and deletes a record', async () => {
            const store = create();
            const id = `a-${run}`;
            await store.save(record(id, `owner-${run}`, 1_000), null);
            assert.deepEqual(await store.get(id), record(id, `owner-${run}`, 1_000));
            await store.save({ ...record(id, `owner-${run}`, 2_000, 2), status: 'final' }, 1);
            assert.equal((await store.get(id))?.status, 'final');
            await store.delete(id);
            assert.equal(await store.get(id), undefined);
        });

        it('lists only the records of one owner, newest first', async () => {
            const store = create();
            const owner = `lister-${run}`;
            await store.save(record(`old-${run}`, owner, 1_000), null);
            await store.save(record(`new-${run}`, owner, 3_000), null);
            await store.save(record(`foreign-${run}`, `other-${run}`, 2_000), null);
            const ids = (await store.listByOwner(owner)).map((r) => r.id);
            assert.deepEqual(ids, [`new-${run}`, `old-${run}`]);
        });

        it('refuses to create an existing record and to replace a changed one', async () => {
            const store = create();
            const id = `lock-${run}`;
            await store.save(record(id, 'o', 1_000), null);
            await assert.rejects(store.save(record(id, 'o', 1_500), null), DraftConflictError);
            await store.save(record(id, 'o', 2_000, 2), 1);
            await assert.rejects(store.save(record(id, 'o', 3_000, 2), 1), DraftConflictError);
            await assert.rejects(store.save(record(`missing-${run}`, 'o', 3_000, 2), 1), DraftConflictError);
            assert.equal((await store.get(id))?.updatedAt.getTime(), 2_000);
        });

        it('lets exactly one of two concurrent writes on the same revision win', async () => {
            const store = create();
            const id = `race-${run}`;
            await store.save(record(id, 'o', 1_000), null);
            const results = await Promise.allSettled([
                store.save({ ...record(id, 'o', 2_000, 2), status: 'final' }, 1),
                store.save(record(id, 'o', 2_500, 2), 1),
            ]);
            assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
            const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
            assert.ok(rejected.reason instanceof DraftConflictError);
        });
    });
}

contract('memory', () => new MemoryDraftStore());

if (process.env['FIRESTORE_EMULATOR_HOST']) {
    const firestore = new FirestoreDraftStore(Keyring.ephemeral());
    contract('firestore (emulator)', () => firestore);

    describe('firestore draft store (emulator)', () => {
        it('writes no plaintext of the payload into the document', async () => {
            const id = `plain-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            await firestore.save(record(id, 'o@example.com', 1_000), null);
            const raw = JSON.stringify(await firestore.rawDocument(id));
            assert.ok(raw.includes('o@example.com'));
            for (const plain of ['Anna', 'Muster', 'Frau', 'zwischenzeugnis', 'intro']) {
                assert.ok(!raw.includes(plain), plain);
            }
        });
    });
}
