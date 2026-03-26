export type MessageStatus = "pending" | "deleted" | "labeled" | "failed";

export interface MessageRecord {
  id: string;
  threadId?: string;
  labels?: string[];
  status: MessageStatus;
  action?: string;
  errorMessage?: string;
  processedAt?: Date;
}

export interface MessageRepository {
  upsert(record: MessageRecord): Promise<void>;
  upsertMany(records: MessageRecord[]): Promise<void>;
  findByStatus(status: MessageStatus): Promise<MessageRecord[]>;
}
