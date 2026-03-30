import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { sessions } from "../db/schema";
import type { HonoVariables } from "../types";
import { sessionMiddleware } from "./session";

// ─── テストアプリ ──────────────────────────────────────────────────────────────
// sessionMiddleware の動作を確認する最小アプリ
const testApp = new Hono<{ Variables: HonoVariables }>();
testApp.use("*", sessionMiddleware);
testApp.get("/test", (c) => {
  const session = c.get("session");
  return c.json({ hasSession: !!session, sessionId: session?.id ?? null });
});

// テスト用セッション ID（他のテストと衝突しない固定値を使用）
const EXPIRED_SESSION_ID = "test-middleware-expired-session";
const VALID_SESSION_ID = "test-middleware-valid-session";

beforeEach(async () => {
  await db.delete(sessions).where(eq(sessions.id, EXPIRED_SESSION_ID));
  await db.delete(sessions).where(eq(sessions.id, VALID_SESSION_ID));
});

afterEach(async () => {
  // 残留テストデータのクリーンアップ
  await db.delete(sessions).where(eq(sessions.id, EXPIRED_SESSION_ID));
  await db.delete(sessions).where(eq(sessions.id, VALID_SESSION_ID));
});

// ─── sessionMiddleware ────────────────────────────────────────────────────────

describe("sessionMiddleware", () => {
  it("期限切れセッション → DB から削除され context に session がセットされない", async () => {
    const now = Math.floor(Date.now() / 1000);
    await db.insert(sessions).values({
      id: EXPIRED_SESSION_ID,
      email: "expired@example.com",
      accessToken: "expired-access-token",
      refreshToken: null,
      expiresAt: now - 3600, // 1 時間前に期限切れ
      createdAt: now - 7200,
    });

    const res = await testApp.request("/test", {
      headers: { Cookie: `session_id=${EXPIRED_SESSION_ID}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { hasSession: boolean };
    expect(body.hasSession).toBe(false);

    // セッションが DB から削除されていることを確認
    const rows = await db.select().from(sessions).where(eq(sessions.id, EXPIRED_SESSION_ID));
    expect(rows.length).toBe(0);
  });

  it("有効なセッション → context に session がセットされる", async () => {
    const now = Math.floor(Date.now() / 1000);
    await db.insert(sessions).values({
      id: VALID_SESSION_ID,
      email: "valid@example.com",
      accessToken: "valid-access-token",
      refreshToken: null,
      expiresAt: now + 3600, // 1 時間後に期限切れ
      createdAt: now,
    });

    const res = await testApp.request("/test", {
      headers: { Cookie: `session_id=${VALID_SESSION_ID}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { hasSession: boolean; sessionId: string | null };
    expect(body.hasSession).toBe(true);
    expect(body.sessionId).toBe(VALID_SESSION_ID);
  });
});
