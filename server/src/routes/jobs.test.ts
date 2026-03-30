import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import type { HonoVariables } from "../types";
import jobsRoutes from "./jobs";

// ─── GmailService のみモック ───────────────────────────────────────────────────
// JobRunner をモックするとモジュールキャッシュを通じて
// services/JobRunner.test.ts に影響するため、GmailService だけをモックする
mock.module("../services/GmailService", () => ({
  GmailService: class MockGmailService {
    async list(_query: unknown) {
      return [] as string[]; // 空リストで即座に完了させる
    }
    async batchDelete(_ids: string[]) {}
  },
}));

// ─── テストアプリ ──────────────────────────────────────────────────────────────

const authApp = new Hono<{ Variables: HonoVariables }>();
authApp.use("*", async (c, next) => {
  c.set("session", {
    id: "test-session-id",
    email: null,
    accessToken: "test-access-token",
    refreshToken: null,
    expiresAt: null,
    createdAt: 0,
  });
  c.set("sessionId", "test-session-id");
  await next();
});
authApp.route("/api/jobs", jobsRoutes);

const unauthApp = new Hono();
unauthApp.route("/api/jobs", jobsRoutes);

// ─── POST /api/jobs ───────────────────────────────────────────────────────────

describe("POST /api/jobs", () => {
  it("認証済み → jobId（UUID 形式）を返す", async () => {
    const res = await authApp.request("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: { category: "promotions" } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { jobId: string };
    expect(typeof body.jobId).toBe("string");
    expect(body.jobId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("未認証 → 401 を返す", async () => {
    const res = await unauthApp.request("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: {} }),
    });
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/jobs/:id ────────────────────────────────────────────────────────

describe("GET /api/jobs/:id", () => {
  it("存在するジョブ → ステータス情報を返す", async () => {
    // まず POST でジョブを開始する（startJob は同期的にジョブを登録する）
    const postRes = await authApp.request("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: {} }),
    });
    expect(postRes.status).toBe(200);
    const { jobId } = (await postRes.json()) as { jobId: string };

    const res = await authApp.request(`/api/jobs/${jobId}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      status: string;
      total: number;
      done: number;
      failed: number;
    };
    expect(body.id).toBe(jobId);
    expect(["pending", "running", "done", "failed"]).toContain(body.status);
  });

  it("存在しないジョブ → 404 を返す", async () => {
    const res = await authApp.request("/api/jobs/not-a-real-job-id-xyz");
    expect(res.status).toBe(404);
  });
});

// ─── GET /api/jobs/:id/stream ─────────────────────────────────────────────────

describe("GET /api/jobs/:id/stream", () => {
  it("存在しないジョブ → 404 を返す", async () => {
    const res = await authApp.request("/api/jobs/not-a-real-job-id-xyz/stream");
    expect(res.status).toBe(404);
  });
});
