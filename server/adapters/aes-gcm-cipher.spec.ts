import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { Keyring, KeyringError } from './aes-gcm-cipher';

function key(): string {
    return randomBytes(32).toString('base64');
}

describe('draft encryption', () => {
    const k1 = key();
    const ring = Keyring.parse(JSON.stringify({ active: 'k1', keys: { k1 } }));

    it('round-trips with a fresh IV per write', () => {
        const a = ring.seal('Anna Muster', 'aad');
        const b = ring.seal('Anna Muster', 'aad');
        assert.notEqual(a.iv, b.iv);
        assert.ok(!Buffer.from(a.ciphertext, 'base64').toString('utf8').includes('Anna'));
        assert.equal(ring.open(a, 'aad'), 'Anna Muster');
        assert.equal(a.keyId, 'k1');
    });

    it('detects changed ciphertext, IV and AAD', () => {
        const sealed = ring.seal('Anna Muster', 'aad');
        const bytes = Buffer.from(sealed.ciphertext, 'base64');
        bytes[0] ^= 1;
        assert.throws(() => ring.open({ ...sealed, ciphertext: bytes.toString('base64') }, 'aad'));
        const iv = Buffer.from(sealed.iv, 'base64');
        iv[0] ^= 1;
        assert.throws(() => ring.open({ ...sealed, iv: iv.toString('base64') }, 'aad'));
        assert.throws(() => ring.open(sealed, 'other'));
    });

    it('reads documents of an older key after a rotation', () => {
        const old = ring.seal('alt', 'aad');
        const rotated = Keyring.parse(JSON.stringify({ active: 'k2', keys: { k1, k2: key() } }));
        assert.equal(rotated.open(old, 'aad'), 'alt');
        assert.equal(rotated.seal('neu', 'aad').keyId, 'k2');
        const withoutOld = Keyring.parse(JSON.stringify({ active: 'k2', keys: { k2: key() } }));
        assert.throws(() => withoutOld.open(old, 'aad'), KeyringError);
    });

    it('refuses a missing or invalid key ring without quoting it', () => {
        assert.throws(() => Keyring.parse(undefined), KeyringError);
        assert.throws(() => Keyring.parse('not json'), KeyringError);
        assert.throws(() => Keyring.parse(JSON.stringify({ active: 'k1', keys: {} })), KeyringError);
        const short = 'c2hvcnQ=';
        assert.throws(
            () => Keyring.parse(JSON.stringify({ active: 'k1', keys: { k1: short } })),
            (e: Error) => e instanceof KeyringError && !e.message.includes(short),
        );
    });
});
