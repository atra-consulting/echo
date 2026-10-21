// Mapping between a draft and its encrypted Firestore document, without an emulator.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { StoredDraft } from '../core/ports';
import { Keyring } from './aes-gcm-cipher';
import { fromDocument, toDocument } from './firestore-draft-store';

const DAY = 24 * 60 * 60 * 1000;
const k1 = randomBytes(32).toString('base64');
const ring = Keyring.parse(JSON.stringify({ active: 'k1', keys: { k1 } }));

function draft(id = 'd1', owner = 'a@example.com'): StoredDraft {
    return {
        id,
        owner,
        status: 'final',
        schemaVersion: 1,
        revision: 3,
        reference: {
            schema_version: 1,
            certificate_type: 'abschlusszeugnis',
            form_data: { salutation: 'Frau', firstname: 'Anna', lastname: 'Muster' },
            selections: [{ step: 'performance', subtopic: 'work_attitude', rating: 'sehr gut', sentence: 1 }],
        },
        createdAt: new Date(1_000),
        updatedAt: new Date(2_000),
        expireAt: new Date(2_000 + 90 * DAY),
    };
}

describe('firestore draft document', () => {
    it('round-trips a draft and keeps only metadata in plaintext', () => {
        const document = toDocument(draft(), ring);
        assert.deepEqual(fromDocument('d1', document, ring), draft());
        assert.deepEqual(Object.keys(document).sort(), [
            'ciphertext',
            'createdAt',
            'expireAt',
            'iv',
            'keyId',
            'owner',
            'revision',
            'schemaVersion',
            'status',
            'updatedAt',
        ]);
        const raw = JSON.stringify(document);
        for (const plain of ['Anna', 'Muster', 'Frau', 'abschlusszeugnis', 'work_attitude', 'sehr gut']) {
            assert.ok(!raw.includes(plain), plain);
        }
        assert.notEqual(toDocument(draft(), ring).iv, document.iv);
    });

    it('detects a changed ciphertext or IV', () => {
        const document = toDocument(draft(), ring);
        const bytes = Buffer.from(document.ciphertext, 'base64');
        bytes[0] ^= 1;
        assert.throws(() => fromDocument('d1', { ...document, ciphertext: bytes.toString('base64') }, ring));
        const iv = Buffer.from(document.iv, 'base64');
        iv[0] ^= 1;
        assert.throws(() => fromDocument('d1', { ...document, iv: iv.toString('base64') }, ring));
    });

    it('refuses a payload moved to another id, owner or schema version', () => {
        const document = toDocument(draft(), ring);
        assert.throws(() => fromDocument('d2', document, ring));
        assert.throws(() => fromDocument('d1', { ...document, owner: 'b@example.com' }, ring));
        assert.throws(() => fromDocument('d1', { ...document, schemaVersion: 2 }, ring));
    });

    it('reads documents of an older key after a rotation', () => {
        const old = toDocument(draft(), ring);
        const rotated = Keyring.parse(
            JSON.stringify({ active: 'k2', keys: { k1, k2: randomBytes(32).toString('base64') } }),
        );
        assert.deepEqual(fromDocument('d1', old, rotated), draft());
        assert.equal(toDocument(draft(), rotated).keyId, 'k2');
        const withoutOld = Keyring.parse(
            JSON.stringify({ active: 'k3', keys: { k3: randomBytes(32).toString('base64') } }),
        );
        assert.throws(() => fromDocument('d1', old, withoutOld));
    });
});
