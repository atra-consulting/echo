// Draft store in the memory of the process: for tests, local development and
// forks without a database. Drafts are gone with the process; nothing leaves
// the process, so they are kept unencrypted.
import { DraftConflictError, DraftStore, StoredDraft } from '../core/ports';

export class MemoryDraftStore implements DraftStore {
    private readonly drafts = new Map<string, StoredDraft>();

    public async get(id: string): Promise<StoredDraft | undefined> {
        const draft = this.drafts.get(id);
        return draft && structuredClone(draft);
    }

    public async listByOwner(owner: string): Promise<StoredDraft[]> {
        return [...this.drafts.values()]
            .filter((d) => d.owner === owner)
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .map((d) => structuredClone(d));
    }

    public async save(draft: StoredDraft, expectedRevision: number | null): Promise<void> {
        // Check and write without an await in between: atomic within the process.
        const current = this.drafts.get(draft.id);
        if (expectedRevision === null ? current !== undefined : current?.revision !== expectedRevision) {
            throw new DraftConflictError();
        }
        this.drafts.set(draft.id, structuredClone(draft));
    }

    public async delete(id: string): Promise<void> {
        this.drafts.delete(id);
    }
}
