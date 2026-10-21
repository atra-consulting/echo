// Ports of the core: interfaces the core needs from the outside world. The
// adapters in server/adapters implement them; main.ts (composition root)
// chooses and wires them from the configuration. Nothing here may import
// Express, the MCP SDK or Google Cloud libraries.
import { CertificateType, TextModules } from '../../src/app/reference-text';
import { ReferenceDraft } from './schemas';

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

export type DraftStatus = 'draft' | 'final';

// A stored draft as the core sees it. owner is the author's email, not the
// employee's. How a store protects the payload (e.g. encryption) is its own business.
export interface StoredDraft {
    id: string;
    owner: string;
    status: DraftStatus;
    schemaVersion: number;
    // Counts the writes; the optimistic lock of save().
    revision: number;
    reference: ReferenceDraft;
    createdAt: Date;
    updatedAt: Date;
    // updatedAt + retention; storage may delete the draft after it (e.g. a TTL policy).
    expireAt: Date;
}

// Persistence of the drafts (memory, Firestore). Every adapter must pass the
// contract tests in server/adapters/draft-store.spec.ts.
export interface DraftStore {
    get(id: string): Promise<StoredDraft | undefined>;
    // Newest first (updatedAt descending).
    listByOwner(owner: string): Promise<StoredDraft[]>;
    // Optimistic concurrency: creates the draft if expectedRevision is null and
    // no draft with this id exists, replaces it only if the stored revision
    // equals expectedRevision. Otherwise throws DraftConflictError.
    save(draft: StoredDraft, expectedRevision: number | null): Promise<void>;
    delete(id: string): Promise<void>;
}

export type Clock = () => Date;

// Another write came first (e.g. finalize racing an update); nothing was written.
export class DraftConflictError extends Error {
    constructor() {
        super('draft was changed concurrently');
    }
}
