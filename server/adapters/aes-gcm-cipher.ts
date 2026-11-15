// DraftCipher with AES-256-GCM, used by the Firestore draft store: whoever may
// read the database (e.g. in the console) sees only owner, status and
// timestamps, never names or ratings.
// The key ring comes from the configuration (on Cloud Run a Secret Manager
// secret injected as environment variable).
//
// Key ring (JSON): {"active": "k2", "keys": {"k1": "<base64, 32 bytes>", "k2": "..."}}
// Writes use the active key, reads the key named in the document (keyId).
// Rotation: add a new key and make it active; remove the old one once no
// document can still use it, i.e. after the retention period.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

// Encrypted payload. A persistence concern of the adapters, not of the core.
export interface Sealed {
    keyId: string;
    // base64
    iv: string;
    // base64, ciphertext followed by the authentication tag
    ciphertext: string;
}

// Authenticated encryption; aad binds the ciphertext to its context (e.g. its document).
export interface DraftCipher {
    seal(plaintext: string, aad: string): Sealed;
    // Throws if the key is unknown or ciphertext, IV or AAD were changed.
    open(sealed: Sealed, aad: string): string;
}

export class KeyringError extends Error {}

export class Keyring implements DraftCipher {
    private constructor(
        public readonly activeKeyId: string,
        private readonly keys: Map<string, Buffer>,
    ) {}

    // Throws a KeyringError without quoting the key material.
    public static parse(json: string | undefined): Keyring {
        if (!json) {
            throw new KeyringError('the key ring is missing');
        }
        let parsed: unknown;
        try {
            parsed = JSON.parse(json);
        } catch {
            throw new KeyringError('the key ring is not valid JSON');
        }
        const { active, keys } = (parsed ?? {}) as { active?: unknown; keys?: unknown };
        if (typeof active !== 'string' || typeof keys !== 'object' || keys === null) {
            throw new KeyringError('the key ring needs "active" and "keys"');
        }
        const map = new Map<string, Buffer>();
        for (const [id, value] of Object.entries(keys)) {
            const key = typeof value === 'string' ? Buffer.from(value, 'base64') : Buffer.alloc(0);
            if (key.length !== 32) {
                throw new KeyringError(`key "${id}" must be 32 bytes in base64`);
            }
            map.set(id, key);
        }
        if (!map.has(active)) {
            throw new KeyringError(`the active key "${active}" is not in the key ring`);
        }
        return new Keyring(active, map);
    }

    // A random key that lives only as long as the process, for tests and local development.
    public static ephemeral(): Keyring {
        return new Keyring('ephemeral', new Map([['ephemeral', randomBytes(32)]]));
    }

    public seal(plaintext: string, aad: string): Sealed {
        const iv = randomBytes(IV_BYTES);
        const cipher = createCipheriv(ALGORITHM, this.key(this.activeKeyId), iv, { authTagLength: TAG_BYTES });
        cipher.setAAD(Buffer.from(aad, 'utf8'));
        const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final(), cipher.getAuthTag()]);
        return { keyId: this.activeKeyId, iv: iv.toString('base64'), ciphertext: ciphertext.toString('base64') };
    }

    // Throws if the key is unknown or ciphertext, IV or AAD were changed.
    public open(sealed: Sealed, aad: string): string {
        const data = Buffer.from(sealed.ciphertext, 'base64');
        const decipher = createDecipheriv(ALGORITHM, this.key(sealed.keyId), Buffer.from(sealed.iv, 'base64'), {
            authTagLength: TAG_BYTES,
        });
        decipher.setAAD(Buffer.from(aad, 'utf8'));
        decipher.setAuthTag(data.subarray(data.length - TAG_BYTES));
        return Buffer.concat([decipher.update(data.subarray(0, data.length - TAG_BYTES)), decipher.final()]).toString(
            'utf8',
        );
    }

    private key(id: string): Buffer {
        const key = this.keys.get(id);
        if (!key) {
            throw new KeyringError(`key "${id}" is not in the key ring`);
        }
        return key;
    }
}
