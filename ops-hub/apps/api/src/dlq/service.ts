export interface DlqEntry {
  id: string;
  payload: unknown;
  error: string;
  attempts: number;
  createdAt: Date;
}

export class DlqService {
  private readonly entries: DlqEntry[] = [];
  list(_tenantId: string) {
    return this.entries;
  }
  replay(_tenantId: string, _id: string) {
    return { replayed: true };
  }
  replayBatch(_tenantId: string, _ids: string[]) {
    return { replayed: _ids.length };
  }
}
