import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id"),
  labels: text("labels"), // JSON シリアライズ: '["INBOX","CATEGORY_PROMOTIONS"]'
  status: text("status").notNull(), // 'pending' | 'deleted' | 'labeled' | 'failed'
  action: text("action"), // 'batchDelete' | 'addLabel'
  errorMessage: text("error_message"),
  processedAt: integer("processed_at", { mode: "timestamp" }),
});

export const syncState = sqliteTable("sync_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // Cookie 値
  email: text("email"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: integer("expires_at"), // Unix timestamp
  createdAt: integer("created_at").notNull(),
});
