import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import type { HonoVariables } from "../types";
import mailsRoutes from "./mails";

// ─── GmailService モック ───────────────────────────────────────────────────────
mock.module("../services/GmailService", () => ({
  GmailService: class MockGmailService {
    async list(_query: unknown) {
      return ["id-1", "id-2", "id-3"];
    }
  },
}));

// ─── テストアプリ ──────────────────────────────────────────────────────────────

// 認証済み: session を直接セットして requireAuth をパスさせる
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
  await next();
});
authApp.route("/api/mails", mailsRoutes);

// 未認証: session をセットしないため requireAuth が 401 を返す
const unauthApp = new Hono();
unauthApp.route("/api/mails", mailsRoutes);

// ─── POST /api/mails/search ───────────────────────────────────────────────────

describe("POST /api/mails/search", () => {
  it("認証済み → ids と count を返す", async () => {
    const res = await authApp.request("/api/mails/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "promotions" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ids: string[]; count: number };
    expect(body.ids).toEqual(["id-1", "id-2", "id-3"]);
    expect(body.count).toBe(3);
  });

  it("未認証 → 401 を返す", async () => {
    const res = await unauthApp.request("/api/mails/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "promotions" }),
    });
    expect(res.status).toBe(401);
  });
});
