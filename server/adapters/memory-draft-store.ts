// Draft store in the memory of the process: for tests, local development and
// forks without a database. Drafts are gone with the process.
import { DraftConflictError, DraftRecord, DraftStore } from '../core/ports';

export class MemoryDraftStore implements DraftStore {
    private readonly records = new Map<string, DraftRecord>();

    public async get(id: string): Promise<DraftRecord | undefined> {
        const record = this.records.get(id);
        return record && { ...record };
    }

    public async listByOwner(owner: string): Promise<DraftRecord[]> {
        return [...this.records.values()]
            .filter((r) => r.owner === owner)
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .map((r) => ({ ...r }));
    }

    public async save(record: DraftRecord, expectedRevision: number | null): Promise<void> {
        // Check and write without an await in between: atomic within the process.
        const current = this.records.get(record.id);
        if (expectedRevision === null ? current !== undefined : current?.revision !== expectedRevision) {
            throw new DraftConflictError();
        }
        this.records.set(record.id, { ...record });
    }

    public async delete(id: string): Promise<void> {
        this.records.delete(id);
    }
}
