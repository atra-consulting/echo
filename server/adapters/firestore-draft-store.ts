// Draft store in Firestore, collection "drafts". The payload (person fields,
// selections) is stored only encrypted (DraftCipher, aes-gcm-cipher.ts): whoever
// may read the database sees owner, status, versions and timestamps, nothing else.
//
// - The list query (owner ==, updatedAt desc) needs a composite index;
//   .github/workflows/deploy.yml creates it. The emulator ignores indexes.
// - A TTL policy on expireAt deletes old documents, with a delay; DraftService
//   treats expired drafts as gone anyway.
// - Locally FIRESTORE_EMULATOR_HOST points the client to the emulator.
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { DraftConflictError, DraftStatus, DraftStore, StoredDraft } from '../core/ports';
import { ReferenceDraft } from '../core/schemas';
import { DraftCipher } from './aes-gcm-cipher';

export const DRAFTS_COLLECTION = 'drafts';

// The stored document. Only keyId, iv and ciphertext carry the payload.
export interface DraftDocument {
    owner: string;
    status: DraftStatus;
    schemaVersion: number;
    revision: number;
    keyId: string;
    iv: string;
    ciphertext: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    expireAt: Timestamp;
}

// Binds the ciphertext to its document: copied to another id, owner or schema version it no longer decrypts.
function aad(id: string, owner: string, schemaVersion: number): string {
    return JSON.stringify([id, owner, schemaVersion]);
}

// Draft -> document: encrypts the payload with the active key and a fresh IV.
export function toDocument(draft: StoredDraft, cipher: DraftCipher): DraftDocument {
    const sealed = cipher.seal(JSON.stringify(draft.reference), aad(draft.id, draft.owner, draft.schemaVersion));
    return {
        owner: draft.owner,
        status: draft.status,
        schemaVersion: draft.schemaVersion,
        revision: draft.revision,
        keyId: sealed.keyId,
        iv: sealed.iv,
        ciphertext: sealed.ciphertext,
        createdAt: Timestamp.fromDate(draft.createdAt),
        updatedAt: Timestamp.fromDate(draft.updatedAt),
        expireAt: Timestamp.fromDate(draft.expireAt),
    };
}

// Document -> draft. Throws if the payload was changed, belongs to another
// document or its key is no longer in the key ring.
export function fromDocument(id: string, document: DraftDocument, cipher: DraftCipher): StoredDraft {
    const plaintext = cipher.open(document, aad(id, document.owner, document.schemaVersion));
    return {
        id: id,
        owner: document.owner,
        status: document.status,
        schemaVersion: document.schemaVersion,
        revision: document.revision,
        reference: JSON.parse(plaintext) as ReferenceDraft,
        createdAt: document.createdAt.toDate(),
        updatedAt: document.updatedAt.toDate(),
        expireAt: document.expireAt.toDate(),
    };
}

export class FirestoreDraftStore implements DraftStore {
    private readonly db: Firestore;

    // Without db the client finds project and credentials itself (ADC).
    constructor(
        private readonly cipher: DraftCipher,
        db?: Firestore,
    ) {
        this.db = db ?? new Firestore({ ignoreUndefinedProperties: true });
    }

    public async get(id: string): Promise<StoredDraft | undefined> {
        const snapshot = await this.collection().doc(id).get();
        return snapshot.exists ? fromDocument(snapshot.id, snapshot.data() as DraftDocument, this.cipher) : undefined;
    }

    // A document that does not decrypt (changed, or its key removed) is left out instead of breaking the list.
    public async listByOwner(owner: string): Promise<StoredDraft[]> {
        const snapshot = await this.collection().where('owner', '==', owner).orderBy('updatedAt', 'desc').get();
        const drafts: StoredDraft[] = [];
        for (const doc of snapshot.docs) {
            const document = doc.data() as DraftDocument;
            try {
                drafts.push(fromDocument(doc.id, document, this.cipher));
            } catch {
                console.error(`Draft ${doc.id} could not be decrypted (key ${document.keyId}).`);
            }
        }
        return drafts;
    }

    // In a transaction: the revision is checked and the document written atomically.
    public async save(draft: StoredDraft, expectedRevision: number | null): Promise<void> {
        const document = toDocument(draft, this.cipher);
        const ref = this.collection().doc(draft.id);
        await this.db.runTransaction(async (transaction) => {
            const current = await transaction.get(ref);
            const revision = current.exists ? (current.data() as DraftDocument).revision : undefined;
            if (expectedRevision === null ? current.exists : revision !== expectedRevision) {
                throw new DraftConflictError();
            }
            transaction.set(ref, document);
        });
    }

    public async delete(id: string): Promise<void> {
        await this.collection().doc(id).delete();
    }

    // The stored document as it is, for tests that check what reaches the database.
    public async rawDocument(id: string): Promise<DraftDocument | undefined> {
        const snapshot = await this.collection().doc(id).get();
        return snapshot.exists ? (snapshot.data() as DraftDocument) : undefined;
    }

    private collection() {
        return this.db.collection(DRAFTS_COLLECTION);
    }
}
