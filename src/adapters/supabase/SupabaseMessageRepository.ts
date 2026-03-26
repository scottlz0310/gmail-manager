import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import type {
  MessageRecord,
  MessageRepository,
  MessageStatus,
} from "@/core/repositories/MessageRepository";

export class SupabaseMessageRepository implements MessageRepository {
  async upsert(record: MessageRecord): Promise<void> {
    await db
      .insert(messages)
      .values({
        id: record.id,
        threadId: record.threadId,
        labels: record.labels,
        status: record.status,
        action: record.action,
        errorMessage: record.errorMessage,
        processedAt: record.processedAt ? new Date(record.processedAt) : new Date(),
      })
      .onConflictDoUpdate({
        target: messages.id,
        set: {
          status: record.status,
          action: record.action,
          errorMessage: record.errorMessage,
          processedAt: new Date(),
        },
      });
  }

  async upsertMany(records: MessageRecord[]): Promise<void> {
    if (records.length === 0) return;
    await db
      .insert(messages)
      .values(
        records.map((r) => ({
          id: r.id,
          threadId: r.threadId,
          labels: r.labels,
          status: r.status,
          action: r.action,
          errorMessage: r.errorMessage,
          processedAt: r.processedAt ? new Date(r.processedAt) : new Date(),
        }))
      )
      .onConflictDoUpdate({
        target: messages.id,
        set: {
          status: sql`excluded.status`,
          action: sql`excluded.action`,
          errorMessage: sql`excluded.error_message`,
          processedAt: new Date(),
        },
      });
  }

  async findByStatus(status: MessageStatus): Promise<MessageRecord[]> {
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.status, status));

    return rows.map((r) => ({
      id: r.id,
      threadId: r.threadId ?? undefined,
      labels: (r.labels as string[] | null) ?? undefined,
      status: r.status as MessageStatus,
      action: r.action ?? undefined,
      errorMessage: r.errorMessage ?? undefined,
      processedAt: r.processedAt ?? undefined,
    }));
  }
}
