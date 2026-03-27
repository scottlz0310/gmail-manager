import { db } from "../db";
import { messages } from "../db/schema";
import { sql } from "drizzle-orm";
import { GmailService, type MailQuery } from "./GmailService";

const CHUNK_SIZE = 500;
const CHUNK_INTERVAL_MS = 200;
const JOB_TTL_MS = 5 * 60 * 1000; // 完了後 5 分でレジストリから削除

export type JobStatus = "pending" | "running" | "done" | "failed";

export interface Job {
  id: string;
  status: JobStatus;
  total: number;
  done: number;
  failed: number;
  error?: string;
  startedAt?: number;
  durationMs?: number;
  listeners: Set<(event: JobEvent) => void>;
}

export type JobEvent =
  | { type: "progress"; done: number; total: number; failed: number }
  | { type: "done"; done: number; total: number; failed: number; durationMs: number }
  | { type: "error"; message: string };

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
    Promise.resolve(
      listener({ type: "done", done: job.done, total: job.total, failed: job.failed, durationMs: job.durationMs ?? 0 })
    ).catch((err) => console.error(JSON.stringify({ action: "emit", error: String(err) })));
  } else if (job.status === "failed") {
    Promise.resolve(
      listener({ type: "error", message: job.error ?? "unknown error" })
    ).catch((err) => console.error(JSON.stringify({ action: "emit", error: String(err) })));
  }
  return () => job.listeners.delete(listener);
}

// async リスナーの reject を握り潰さないよう Promise.resolve で包む
function emit(job: Job, event: JobEvent) {
  for (const listener of job.listeners) {
    Promise.resolve(listener(event)).catch((err) => {
      console.error(JSON.stringify({ action: "emit", error: String(err) }));
    });
  }
}

// 終了状態のジョブを TTL 後にレジストリから削除
function scheduleCleanup(job: Job) {
  setTimeout(() => {
    job.listeners.clear();
    jobs.delete(job.id);
  }, JOB_TTL_MS);
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

  runJob(job, accessToken, query).catch((err) => {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : String(err);
    emit(job, { type: "error", message: job.error });
    console.error(JSON.stringify({ action: "job", jobId, status: "failed", error: job.error }));
    scheduleCleanup(job);
  });
}

async function runJob(job: Job, accessToken: string, query: MailQuery): Promise<void> {
  job.status = "running";
  job.startedAt = Date.now();
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
  job.durationMs = Date.now() - (job.startedAt ?? Date.now());
  emit(job, { type: "done", done: job.done, total: job.total, failed: job.failed, durationMs: job.durationMs });
  console.log(JSON.stringify({ action: "job", jobId: job.id, status: "done", done: job.done, failed: job.failed, duration_ms: job.durationMs }));
  scheduleCleanup(job);
}
