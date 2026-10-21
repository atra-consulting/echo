// Draft lifecycle per user: ownership, retention, final drafts are read-only,
// export and import. Framework-free use cases; the REST API (http/) and the
// MCP tools (mcp/) are thin layers over DraftService.
//
// DraftService -> EncryptedDraftRepository (plaintext in, DraftCipher) ->
// DraftStore (encrypted records; memory or Firestore adapter). Every store goes
// through the encryption: DraftService builds the repository itself.
import { randomBytes } from 'node:crypto';
import { Clock, DraftCipher, DraftRecord, DraftStatus, DraftStore, TextModuleSource } from './ports';

export { DraftConflictError } from './ports';
import {
    DraftExport,
    DraftPatch,
    EXPORT_FORMAT,
    REFERENCE_DRAFT_VERSION,
    ReferenceDraft,
    referenceDraft,
} from './schemas';
import { Draft, StepBox, StepStatus, draft as composeDraft, stepBox, stepIds } from './steps';

export interface StoredDraft {
    id: string;
    owner: string;
    status: DraftStatus;
    schemaVersion: number;
    revision: number;
    reference: ReferenceDraft;
    createdAt: Date;
    updatedAt: Date;
    expireAt: Date;
}

interface DraftRepository {
    get(id: string): Promise<StoredDraft | undefined>;
    listByOwner(owner: string): Promise<StoredDraft[]>;
    // expectedRevision: null to create, otherwise the revision that was read (optimistic lock).
    save(draft: StoredDraft, expectedRevision: number | null): Promise<void>;
    delete(id: string): Promise<void>;
}

// Binds the ciphertext to its document: copied to another id, owner or schema version it no longer decrypts.
function aad(id: string, owner: string, schemaVersion: number): string {
    return JSON.stringify([id, owner, schemaVersion]);
}

class EncryptedDraftRepository implements DraftRepository {
    constructor(
        private readonly store: DraftStore,
        private readonly cipher: DraftCipher,
    ) {}

    public async get(id: string): Promise<StoredDraft | undefined> {
        const record = await this.store.get(id);
        return record && this.open(record);
    }

    // A record that does not decrypt (changed, or its key removed) is left out instead of breaking the list.
    public async listByOwner(owner: string): Promise<StoredDraft[]> {
        const drafts: StoredDraft[] = [];
        for (const record of await this.store.listByOwner(owner)) {
            try {
                drafts.push(this.open(record));
            } catch {
                console.error(`Draft ${record.id} could not be decrypted (key ${record.keyId}).`);
            }
        }
        return drafts;
    }

    public async save(draft: StoredDraft, expectedRevision: number | null): Promise<void> {
        const { reference, ...meta } = draft;
        const sealed = this.cipher.seal(JSON.stringify(reference), aad(draft.id, draft.owner, draft.schemaVersion));
        await this.store.save({ ...meta, ...sealed }, expectedRevision);
    }

    public async delete(id: string): Promise<void> {
        await this.store.delete(id);
    }

    private open(record: DraftRecord): StoredDraft {
        const plaintext = this.cipher.open(record, aad(record.id, record.owner, record.schemaVersion));
        const { id, owner, status, schemaVersion, revision, createdAt, updatedAt, expireAt } = record;
        const reference = JSON.parse(plaintext) as ReferenceDraft;
        return { id, owner, status, schemaVersion, revision, reference, createdAt, updatedAt, expireAt };
    }
}

export class DraftNotFoundError extends Error {
    constructor() {
        super('draft not found');
    }
}

export class DraftFinalError extends Error {
    constructor() {
        super('draft is final');
    }
}

export interface DraftSummary {
    id: string;
    status: DraftStatus;
    revision: number;
    certificate_type: string;
    // Name of the person, to recognise the draft in the list.
    title: string;
    created_at: string;
    updated_at: string;
    expire_at: string;
}

export interface DraftView extends DraftSummary {
    draft: ReferenceDraft;
    // Text so far, progress and the selected sentences in their current wording.
    result: Draft;
}

// One step in the variant of the draft, with what the draft selected in it.
export interface DraftStepView extends StepBox {
    draft_id: string;
    current: StepStatus;
    open_steps: string[];
}

export class UnknownStepError extends Error {
    constructor(public readonly allowed: string[]) {
        super('unknown step');
    }
}

export interface DraftServiceOptions {
    retentionDays: number;
    clock?: Clock;
}

export class DraftService {
    private readonly now: Clock;
    private readonly repository: DraftRepository;

    constructor(
        store: DraftStore,
        cipher: DraftCipher,
        private readonly textModules: TextModuleSource,
        private readonly options: DraftServiceOptions,
    ) {
        this.repository = new EncryptedDraftRepository(store, cipher);
        this.now = options.clock ?? (() => new Date());
    }

    public get retentionDays(): number {
        return this.options.retentionDays;
    }

    public async list(owner: string): Promise<DraftSummary[]> {
        const drafts = await this.repository.listByOwner(owner);
        return drafts.filter((d) => !this.expired(d)).map((d) => summary(d));
    }

    // Validates the selections (SelectionError) before anything is stored.
    public async create(owner: string, reference: ReferenceDraft): Promise<DraftView> {
        const normalized = normalize(reference);
        const result = this.compose(normalized);
        const now = this.now();
        const draft: StoredDraft = {
            id: randomBytes(18).toString('base64url'),
            owner: owner,
            status: 'draft',
            schemaVersion: REFERENCE_DRAFT_VERSION,
            revision: 1,
            reference: normalized,
            createdAt: now,
            updatedAt: now,
            expireAt: this.expireAt(now),
        };
        await this.repository.save(draft, null);
        return view(draft, result);
    }

    // Foreign, missing and expired drafts are all "not found".
    public async get(owner: string, id: string): Promise<DraftView> {
        const draft = await this.load(owner, id);
        return view(draft, this.compose(draft.reference));
    }

    public async step(owner: string, id: string, step: string): Promise<DraftStepView> {
        const draft = await this.load(owner, id);
        const textModules = this.textModules.get(
            draft.reference.certificate_type,
            draft.reference.form_data.salutation,
        );
        const box = stepBox(textModules, step);
        if (!box) {
            throw new UnknownStepError(stepIds(textModules));
        }
        const result = this.compose(draft.reference);
        const current = result.steps.find((s) => s.step === step) as StepStatus;
        return { draft_id: draft.id, ...box, current: current, open_steps: result.open_steps };
    }

    public async replace(owner: string, id: string, reference: ReferenceDraft): Promise<DraftView> {
        const draft = await this.editable(owner, id);
        return this.store(draft, normalize(reference));
    }

    // Changes person fields and/or replaces the selections of one step.
    public async update(owner: string, id: string, patch: DraftPatch): Promise<DraftView> {
        const draft = await this.editable(owner, id);
        const reference = structuredClone(draft.reference);
        for (const [name, value] of Object.entries(patch.form_data ?? {})) {
            const fields = reference.form_data as Record<string, string | undefined>;
            if (value === undefined || (value as string) === '') {
                delete fields[name];
            } else {
                fields[name] = value;
            }
        }
        if (patch.step !== undefined) {
            reference.selections = [
                ...reference.selections.filter((s) => s.step !== patch.step),
                ...(patch.selections ?? []).map((s) => ({ ...s, step: patch.step as string })),
            ];
        } else if (patch.selections !== undefined) {
            throw new DraftPatchError();
        }
        return this.store(draft, normalize(reference));
    }

    public async delete(owner: string, id: string): Promise<void> {
        await this.load(owner, id);
        await this.repository.delete(id);
    }

    // Final drafts are read-only. Finalizing again changes nothing.
    public async finalize(owner: string, id: string): Promise<DraftView> {
        const draft = await this.load(owner, id);
        if (draft.status === 'final') {
            return view(draft, this.compose(draft.reference));
        }
        return this.store({ ...draft, status: 'final' }, draft.reference);
    }

    public async export(owner: string, id: string): Promise<DraftExport> {
        const draft = await this.load(owner, id);
        return {
            format: EXPORT_FORMAT,
            schema_version: REFERENCE_DRAFT_VERSION,
            status: draft.status,
            exported_at: this.now().toISOString(),
            draft: draft.reference,
        };
    }

    // Always a new, editable draft of the importing user.
    public async import(owner: string, data: DraftExport): Promise<DraftView> {
        return this.create(owner, data.draft);
    }

    private compose(reference: ReferenceDraft): Draft {
        const textModules = this.textModules.get(reference.certificate_type, reference.form_data.salutation);
        return composeDraft(textModules, reference.selections, reference.form_data);
    }

    private async store(draft: StoredDraft, reference: ReferenceDraft): Promise<DraftView> {
        const result = this.compose(reference);
        const now = this.now();
        const updated: StoredDraft = {
            ...draft,
            reference,
            revision: draft.revision + 1,
            updatedAt: now,
            expireAt: this.expireAt(now),
        };
        // Fails with DraftConflictError if another write came after the read (e.g. finalize racing an update).
        await this.repository.save(updated, draft.revision);
        return view(updated, result);
    }

    private async load(owner: string, id: string): Promise<StoredDraft> {
        const draft = await this.repository.get(id);
        if (!draft || draft.owner !== owner || this.expired(draft)) {
            throw new DraftNotFoundError();
        }
        return draft;
    }

    private async editable(owner: string, id: string): Promise<StoredDraft> {
        const draft = await this.load(owner, id);
        if (draft.status === 'final') {
            throw new DraftFinalError();
        }
        return draft;
    }

    // The TTL deletion of Firestore can lag behind by a day or more.
    private expired(draft: StoredDraft): boolean {
        return draft.expireAt.getTime() <= this.now().getTime();
    }

    private expireAt(now: Date): Date {
        return new Date(now.getTime() + this.options.retentionDays * 24 * 60 * 60 * 1000);
    }
}

export class DraftPatchError extends Error {
    constructor() {
        super('selections need a step');
    }
}

function normalize(reference: ReferenceDraft): ReferenceDraft {
    return referenceDraft.parse({ ...reference, schema_version: REFERENCE_DRAFT_VERSION });
}

function summary(draft: StoredDraft): DraftSummary {
    const fields = draft.reference.form_data as Record<string, string | undefined>;
    const [firstname, lastname] = [fields['firstname'], fields['lastname']];
    return {
        id: draft.id,
        status: draft.status,
        revision: draft.revision,
        certificate_type: draft.reference.certificate_type,
        title: [firstname, lastname].filter((part) => part).join(' '),
        created_at: draft.createdAt.toISOString(),
        updated_at: draft.updatedAt.toISOString(),
        expire_at: draft.expireAt.toISOString(),
    };
}

function view(draft: StoredDraft, result: Draft): DraftView {
    return { ...summary(draft), draft: draft.reference, result: result };
}
