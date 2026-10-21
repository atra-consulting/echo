// Ports of the core: interfaces the core needs from the outside world. The
// adapters in server/adapters implement them; main.ts (composition root)
// chooses and wires them from the configuration. Nothing here may import
// Express, the MCP SDK or Google Cloud libraries.
import { CertificateType, TextModules } from '../../src/app/reference-text';

// Where the text modules come from: bundled with the build, or a directory of
// the operator (forks bring their own modules).
export interface TextModuleSource {
    // The variant for the salutation "Frau" or the default variant.
    get(certificateType: CertificateType, salutation?: string): TextModules;
}

// The signed-in person. Only ever taken from a verified source.
export interface Identity {
    email: string;
    // Stable even if the email address changes.
    subject: string;
}

// Who is calling: from a verified IAP assertion, or a fixed development user.
export interface IdentityProvider {
    identify(headers: Record<string, string | string[] | undefined>): Promise<Identity | undefined>;
}

// Encrypted payload of a stored draft.
export interface Sealed {
    keyId: string;
    // base64
    iv: string;
    // base64, ciphertext followed by the authentication tag
    ciphertext: string;
}

// Authenticated encryption of the draft payload. aad binds the ciphertext to its document.
export interface DraftCipher {
    seal(plaintext: string, aad: string): Sealed;
    // Throws if the key is unknown or ciphertext, IV or AAD were changed.
    open(sealed: Sealed, aad: string): string;
}

export type DraftStatus = 'draft' | 'final';

// What a store keeps: the payload only encrypted. owner is the author's email,
// not the employee's.
export interface DraftRecord extends Sealed {
    id: string;
    owner: string;
    status: DraftStatus;
    schemaVersion: number;
    // Counts the writes; the optimistic lock of save().
    revision: number;
    createdAt: Date;
    updatedAt: Date;
    // updatedAt + retention; storage may delete the record after it (e.g. a TTL policy).
    expireAt: Date;
}

// Persistence of the encrypted drafts (memory, Firestore). Every adapter must
// pass the contract tests in server/adapters/draft-store.spec.ts.
export interface DraftStore {
    get(id: string): Promise<DraftRecord | undefined>;
    // Newest first (updatedAt descending).
    listByOwner(owner: string): Promise<DraftRecord[]>;
    // Optimistic concurrency: creates the record if expectedRevision is null
    // and no record with this id exists, replaces it only if the stored
    // revision equals expectedRevision. Otherwise throws DraftConflictError.
    save(record: DraftRecord, expectedRevision: number | null): Promise<void>;
    delete(id: string): Promise<void>;
}

export type Clock = () => Date;

// Another write came first (e.g. finalize racing an update); nothing was written.
export class DraftConflictError extends Error {
    constructor() {
        super('draft was changed concurrently');
    }
}
