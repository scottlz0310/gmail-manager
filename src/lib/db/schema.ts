import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id"),
  labels: jsonb("labels").$type<string[]>(),
  status: text("status").notNull(), // 'pending' | 'deleted' | 'labeled' | 'failed'
  action: text("action"), // 'batchDelete' | 'addLabel'
  errorMessage: text("error_message"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

export const syncState = pgTable("sync_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});
