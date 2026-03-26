import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

type GlobalDb = {
  postgresClient?: ReturnType<typeof postgres>;
  db?: ReturnType<typeof drizzle>;
};

const globalForDb = globalThis as typeof globalThis & GlobalDb;

const client = globalForDb.postgresClient ?? postgres(connectionString);
if (!globalForDb.postgresClient) {
  globalForDb.postgresClient = client;
}

export const db = globalForDb.db ?? drizzle(client, { schema });
if (!globalForDb.db) {
  globalForDb.db = db;
}
