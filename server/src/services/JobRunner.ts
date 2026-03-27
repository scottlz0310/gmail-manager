import { db } from "../db";
import { messages } from "../db/schema";
import { sql } from "drizzle-orm";
import { GmailService, type MailQuery } from "./GmailService";

const CHUNK_SIZE = 500;
const CHUNK_INTERVAL_MS = 200;

export type JobStatus = "pending" | "running" | "done" | "failed";

export interface Job {
  id: string;
  status: JobStatus;
  total: number;
  done: number;
  failed: number;
  error?: string;
  listeners: Set<(event: JobEvent) => void>;
}

export type JobEvent =
  | { type: "progress"; done: number; total: number; failed: number }
  | { type: "done"; done: number; total: number; failed: number }
  | { type: "error"; message: string };

// インメモリジョブレジストリ
const jobs = new Map<string, Job>();

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function subscribeJob(id: string, listener: (event: JobEvent) => void): () => void {
  const job = jobs.get(id);
  if (!job) return () => {};
  job.listeners.add(listener);
  // 既に完了済みなら即時通知
  if (job.status === "done") {
    listener({ type: "done", done: job.done, total: job.total, failed: job.failed });
  } else if (job.status === "failed") {
    listener({ type: "error", message: job.error ?? "unknown error" });
  }
  return () => job.listeners.delete(listener);
}

function emit(job: Job, event: JobEvent) {
  for (const listener of job.listeners) {
    try { listener(event); } catch { /* ignore */ }
  }
}

export async function startJob(jobId: string, accessToken: string, query: MailQuery): Promise<void> {
  const job: Job = {
    id: jobId,
    status: "pending",
    total: 0,
    done: 0,
    failed: 0,
    listeners: new Set(),
  };
  jobs.set(jobId, job);

  // 非同期で実行（await しない）
  runJob(job, accessToken, query).catch((err) => {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : String(err);
    emit(job, { type: "error", message: job.error });
    console.error(JSON.stringify({ action: "job", jobId, status: "failed", error: job.error }));
  });
}

async function runJob(job: Job, accessToken: string, query: MailQuery): Promise<void> {
  job.status = "running";
  const gmail = new GmailService(accessToken);

  const ids = await gmail.list(query);
  job.total = ids.length;
  emit(job, { type: "progress", done: 0, total: job.total, failed: 0 });

  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);

    try {
      await gmail.batchDelete(chunk);
      await db
        .insert(messages)
        .values(chunk.map((id) => ({
          id,
          status: "deleted" as const,
          action: "batchDelete",
          processedAt: new Date(),
        })))
        .onConflictDoUpdate({
          target: messages.id,
          set: { status: "deleted", action: "batchDelete", processedAt: new Date() },
        });

      job.done += chunk.length;
      console.log(JSON.stringify({ action: "batchDelete", count: chunk.length, status: "success" }));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      await db
        .insert(messages)
        .values(chunk.map((id) => ({
          id,
          status: "failed" as const,
          action: "batchDelete",
          errorMessage,
          processedAt: new Date(),
        })))
        .onConflictDoUpdate({
          target: messages.id,
          set: {
            status: "failed",
            action: "batchDelete",
            errorMessage: sql`excluded.error_message`,
            processedAt: new Date(),
          },
        });

      job.failed += chunk.length;
      console.error(JSON.stringify({ action: "batchDelete", count: chunk.length, status: "failed", error: errorMessage }));
    }

    emit(job, { type: "progress", done: job.done, total: job.total, failed: job.failed });

    if (i + CHUNK_SIZE < ids.length) {
      await new Promise((r) => setTimeout(r, CHUNK_INTERVAL_MS));
    }
  }

  job.status = "done";
  emit(job, { type: "done", done: job.done, total: job.total, failed: job.failed });
  console.log(JSON.stringify({ action: "job", jobId: job.id, status: "done", done: job.done, failed: job.failed }));
}
