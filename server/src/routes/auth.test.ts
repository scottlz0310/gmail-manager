import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { sessionMiddleware } from "../middleware/session";
import authRoutes from "./auth";

// sessionMiddleware + auth ルートだけを含む最小テストアプリ
const testApp = new Hono();
testApp.use("*", sessionMiddleware);
testApp.route("/api/auth", authRoutes);

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe("GET /api/auth/me", () => {
  it("Cookie なし → loggedIn: false を返す", async () => {
    const res = await testApp.request("/api/auth/me");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { loggedIn: boolean };
    expect(body.loggedIn).toBe(false);
  });

  it("存在しない session_id Cookie → loggedIn: false を返す", async () => {
    const res = await testApp.request("/api/auth/me", {
      headers: { Cookie: "session_id=invalid-session-id" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { loggedIn: boolean };
    expect(body.loggedIn).toBe(false);
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

describe("POST /api/auth/logout", () => {
  it("セッションなしでもエラーにならず ok: true を返す", async () => {
    const res = await testApp.request("/api/auth/logout", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
