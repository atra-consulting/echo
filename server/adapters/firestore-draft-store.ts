// Draft store in Firestore, collection "drafts". The documents hold the
// payload only encrypted (see core/drafts.ts and aes-gcm-cipher.ts).
//
// - The list query (owner ==, updatedAt desc) needs a composite index;
//   .github/workflows/deploy.yml creates it. The emulator ignores indexes.
// - A TTL policy on expireAt deletes old documents, with a delay; DraftService
//   treats expired documents as gone anyway.
// - Locally FIRESTORE_EMULATOR_HOST points the client to the emulator.
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { DraftConflictError, DraftRecord, DraftStatus, DraftStore } from '../core/ports';

export const DRAFTS_COLLECTION = 'drafts';

interface DraftDocument {
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

export class FirestoreDraftStore implements DraftStore {
    private readonly db: Firestore;

    // Without arguments the client finds project and credentials itself (ADC).
    constructor(db?: Firestore) {
        this.db = db ?? new Firestore({ ignoreUndefinedProperties: true });
    }

    public async get(id: string): Promise<DraftRecord | undefined> {
        const snapshot = await this.collection().doc(id).get();
        return snapshot.exists ? record(snapshot.id, snapshot.data() as DraftDocument) : undefined;
    }

    public async listByOwner(owner: string): Promise<DraftRecord[]> {
        const snapshot = await this.collection().where('owner', '==', owner).orderBy('updatedAt', 'desc').get();
        return snapshot.docs.map((doc) => record(doc.id, doc.data() as DraftDocument));
    }

    // In a transaction: the revision is checked and the document written atomically.
    public async save(draft: DraftRecord, expectedRevision: number | null): Promise<void> {
        const document: DraftDocument = {
            owner: draft.owner,
            status: draft.status,
            schemaVersion: draft.schemaVersion,
            revision: draft.revision,
            keyId: draft.keyId,
            iv: draft.iv,
            ciphertext: draft.ciphertext,
            createdAt: Timestamp.fromDate(draft.createdAt),
            updatedAt: Timestamp.fromDate(draft.updatedAt),
            expireAt: Timestamp.fromDate(draft.expireAt),
        };
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

    private collection() {
        return this.db.collection(DRAFTS_COLLECTION);
    }
}

function record(id: string, document: DraftDocument): DraftRecord {
    return {
        id: id,
        owner: document.owner,
        status: document.status,
        schemaVersion: document.schemaVersion,
        revision: document.revision,
        keyId: document.keyId,
        iv: document.iv,
        ciphertext: document.ciphertext,
        createdAt: document.createdAt.toDate(),
        updatedAt: document.updatedAt.toDate(),
        expireAt: document.expireAt.toDate(),
    };
}
