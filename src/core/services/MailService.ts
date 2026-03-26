export interface MailQuery {
  category?: "promotions" | "social" | "updates";
  olderThanDays?: number;
  isUnread?: boolean;
  label?: string;
}

export interface MailService {
  list(query: MailQuery): Promise<string[]>;
  batchDelete(ids: string[]): Promise<void>;
}
