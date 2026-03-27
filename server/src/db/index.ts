import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const DATA_DIR = resolve(import.meta.dir, "../../../data");
const DB_PATH = resolve(DATA_DIR, "gmail-manager.db");

// data/ ディレクトリがなければ作成
mkdirSync(DATA_DIR, { recursive: true });

const sqlite = new Database(DB_PATH, { create: true });
sqlite.exec("PRAGMA journal_mode = WAL;");

// テーブルが存在しなければ作成（マイグレーション不要）
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id           TEXT PRIMARY KEY,
    thread_id    TEXT,
    labels       TEXT,
    status       TEXT NOT NULL,
    action       TEXT,
    error_message TEXT,
    processed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS sync_state (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id            TEXT PRIMARY KEY,
    email         TEXT,
    access_token  TEXT NOT NULL,
    refresh_token TEXT,
    expires_at    INTEGER,
    created_at    INTEGER NOT NULL
  );
`);

export const db = drizzle(sqlite, { schema });
