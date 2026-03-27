import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { requireAuth } from "../middleware/session";
import type { MailQuery } from "../services/GmailService";
import { getJob, startJob, subscribeJob } from "../services/JobRunner";
import type { HonoVariables } from "../types";

const app = new Hono<{ Variables: HonoVariables }>();

app.use("*", requireAuth);

// POST /api/jobs → ジョブ開始・job ID を返す
app.post("/", async (c) => {
  const session = c.get("session") as { accessToken: string };
  const body = await c.req.json<{ query: MailQuery }>();

  const jobId = randomUUID();
  await startJob(jobId, session.accessToken, body.query);

  return c.json({ jobId });
});

// GET /api/jobs/:id → ジョブ状態確認
app.get("/:id", (c) => {
  const job = getJob(c.req.param("id"));
  if (!job) return c.json({ error: "not found" }, 404);
  return c.json({
    id: job.id,
    status: job.status,
    total: job.total,
    done: job.done,
    failed: job.failed,
  });
});

// GET /api/jobs/:id/stream → SSE で進捗をストリーミング
app.get("/:id/stream", (c) => {
  const jobId = c.req.param("id");
  const job = getJob(jobId);
  if (!job) return c.json({ error: "not found" }, 404);

  return streamSSE(c, async (stream) => {
    await new Promise<void>((resolve) => {
      const unsubscribe = subscribeJob(jobId, async (event) => {
        if (event.type === "progress") {
          await stream.writeSSE({
            event: "progress",
            data: JSON.stringify({ done: event.done, total: event.total, failed: event.failed }),
          });
        } else if (event.type === "done") {
          await stream.writeSSE({
            event: "done",
            data: JSON.stringify({
              done: event.done,
              total: event.total,
              failed: event.failed,
              durationMs: event.durationMs,
            }),
          });
          unsubscribe();
          resolve();
        } else if (event.type === "error") {
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({ message: event.message }),
          });
          unsubscribe();
          resolve();
        }
      });
    });
  });
});

export default app;
