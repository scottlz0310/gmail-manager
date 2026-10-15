import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db";
import { sessions } from "../db/schema";
import type { TokenRefresher } from "../services/googleAuth";
import type { HonoVariables } from "../types";
import { createSessionMiddleware, sessionMiddleware } from "./session";

// ─── テストアプリヘルパー ────────────────────────────────────────────────────────
function buildTestApp(tokenRefresher?: TokenRefresher) {
  const app = new Hono<{ Variables: HonoVariables }>();
  app.use("*", tokenRefresher ? createSessionMiddleware(tokenRefresher) : sessionMiddleware);
  app.get("/test", (c) => {
    const session = c.get("session");
    return c.json({
      hasSession: !!session,
      sessionId: session?.id ?? null,
      accessToken: session?.accessToken ?? null,
      refreshToken: session?.refreshToken ?? null,
      expiresAt: session?.expiresAt ?? null,
    });
  });
  return app;
}

const defaultTestApp = buildTestApp();

// テスト用セッション ID
const EXPIRED_SESSION_ID = "test-middleware-expired-session";
const VALID_SESSION_ID = "test-middleware-valid-session";
const REFRESH_SESSION_ID = "test-middleware-refresh-session";

const TEST_SESSION_IDS = [EXPIRED_SESSION_ID, VALID_SESSION_ID, REFRESH_SESSION_ID];

async function cleanupTestSessions() {
  for (const id of TEST_SESSION_IDS) {
    await db.delete(sessions).where(eq(sessions.id, id));
  }
}

beforeEach(async () => {
  await cleanupTestSessions();
});

afterEach(async () => {
  await cleanupTestSessions();
});

// ─── sessionMiddleware ────────────────────────────────────────────────────────

describe("sessionMiddleware", () => {
  it("期限切れセッション（リフレッシュトークンなし） → DB から削除され context に session がセットされない", async () => {
    const now = Math.floor(Date.now() / 1000);
    await db.insert(sessions).values({
      id: EXPIRED_SESSION_ID,
      email: "expired@example.com",
      accessToken: "expired-access-token",
      refreshToken: null,
      expiresAt: now - 3600, // 1 時間前に期限切れ
      createdAt: now - 7200,
    });

    const res = await defaultTestApp.request("/test", {
      headers: { Cookie: `session_id=${EXPIRED_SESSION_ID}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { hasSession: boolean };
    expect(body.hasSession).toBe(false);

    // セッションが DB から削除されていることを確認
    const rows = await db.select().from(sessions).where(eq(sessions.id, EXPIRED_SESSION_ID));
    expect(rows.length).toBe(0);

    // Set-Cookie ヘッダーでセッションがクリアされていることを確認
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("session_id=");
  });

  it("有効なセッション（期限に余裕あり） → リフレッシュされず context に session がセットされる", async () => {
    const now = Math.floor(Date.now() / 1000);
    await db.insert(sessions).values({
      id: VALID_SESSION_ID,
      email: "valid@example.com",
      accessToken: "valid-access-token",
      refreshToken: "dummy-refresh-token",
      expiresAt: now + 3600, // 1 時間後
      createdAt: now,
    });

    let refresherCalled = false;
    const app = buildTestApp(async () => {
      refresherCalled = true;
      throw new Error("should not be called");
    });

    const res = await app.request("/test", {
      headers: { Cookie: `session_id=${VALID_SESSION_ID}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      hasSession: boolean;
      sessionId: string | null;
      accessToken: string | null;
    };
    expect(body.hasSession).toBe(true);
    expect(body.sessionId).toBe(VALID_SESSION_ID);
    expect(body.accessToken).toBe("valid-access-token");
    expect(refresherCalled).toBe(false);
  });

  it("期限切れセッション（リフレッシュトークンあり） → トークン更新に成功し DB と context が更新される", async () => {
    const now = Math.floor(Date.now() / 1000);
    await db.insert(sessions).values({
      id: REFRESH_SESSION_ID,
      email: "user@example.com",
      accessToken: "old-access-token",
      refreshToken: "valid-refresh-token",
      expiresAt: now - 100, // 期限切れ
      createdAt: now - 3700,
    });

    const newExpiresAt = now + 3600;
    const mockRefresher: TokenRefresher = async (token) => {
      expect(token).toBe("valid-refresh-token");
      return {
        accessToken: "new-access-token-123",
        refreshToken: "rotated-refresh-token",
        expiresAt: newExpiresAt,
      };
    };

    const app = buildTestApp(mockRefresher);
    const res = await app.request("/test", {
      headers: { Cookie: `session_id=${REFRESH_SESSION_ID}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      hasSession: boolean;
      sessionId: string | null;
      accessToken: string | null;
      refreshToken: string | null;
      expiresAt: number | null;
    };

    expect(body.hasSession).toBe(true);
    expect(body.sessionId).toBe(REFRESH_SESSION_ID);
    expect(body.accessToken).toBe("new-access-token-123");
    expect(body.refreshToken).toBe("rotated-refresh-token");
    expect(body.expiresAt).toBe(newExpiresAt);

    // DB も更新されていることを確認
    const [row] = await db.select().from(sessions).where(eq(sessions.id, REFRESH_SESSION_ID));
    expect(row).toBeDefined();
    expect(row.accessToken).toBe("new-access-token-123");
    expect(row.refreshToken).toBe("rotated-refresh-token");
    expect(row.expiresAt).toBe(newExpiresAt);
  });

  it("期限間近セッション（残り5分未満） → 事前リフレッシュが行われる", async () => {
    const now = Math.floor(Date.now() / 1000);
    await db.insert(sessions).values({
      id: REFRESH_SESSION_ID,
      email: "user@example.com",
      accessToken: "expiring-soon-access-token",
      refreshToken: "keep-refresh-token",
      expiresAt: now + 120, // 残り 2 分（300 秒未満）
      createdAt: now - 3480,
    });

    const newExpiresAt = now + 3600;
    let refresherCalled = false;
    const mockRefresher: TokenRefresher = async () => {
      refresherCalled = true;
      return {
        accessToken: "refreshed-early-access-token",
        refreshToken: null, // ローテーションなし
        expiresAt: newExpiresAt,
      };
    };

    const app = buildTestApp(mockRefresher);
    const res = await app.request("/test", {
      headers: { Cookie: `session_id=${REFRESH_SESSION_ID}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      hasSession: boolean;
      accessToken: string | null;
      refreshToken: string | null;
    };
    expect(refresherCalled).toBe(true);
    expect(body.accessToken).toBe("refreshed-early-access-token");
    expect(body.refreshToken).toBe("keep-refresh-token"); // null の場合は元の refreshToken を維持
  });

  it("期限切れセッションでリフレッシュ失敗（invalid_grant等） → DB から削除され Cookie クリア", async () => {
    const now = Math.floor(Date.now() / 1000);
    await db.insert(sessions).values({
      id: REFRESH_SESSION_ID,
      email: "revoked@example.com",
      accessToken: "expired-token",
      refreshToken: "revoked-refresh-token",
      expiresAt: now - 60, // 期限切れ
      createdAt: now - 3660,
    });

    const mockRefresher: TokenRefresher = async () => {
      throw new Error("invalid_grant: Token has been expired or revoked.");
    };

    const app = buildTestApp(mockRefresher);
    const res = await app.request("/test", {
      headers: { Cookie: `session_id=${REFRESH_SESSION_ID}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { hasSession: boolean };
    expect(body.hasSession).toBe(false);

    // DB から削除
    const rows = await db.select().from(sessions).where(eq(sessions.id, REFRESH_SESSION_ID));
    expect(rows.length).toBe(0);

    // Cookie クリア
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("session_id=");
  });

  it("期限間近（残り2分）でリフレッシュ一時失敗 → 有効期限内なのでセッション維持してリクエスト継続", async () => {
    const now = Math.floor(Date.now() / 1000);
    await db.insert(sessions).values({
      id: REFRESH_SESSION_ID,
      email: "temporary-fail@example.com",
      accessToken: "still-valid-access-token",
      refreshToken: "refresh-token",
      expiresAt: now + 120, // 残り 2 分
      createdAt: now - 3480,
    });

    const mockRefresher: TokenRefresher = async () => {
      throw new Error("503 Service Unavailable");
    };

    const app = buildTestApp(mockRefresher);
    const res = await app.request("/test", {
      headers: { Cookie: `session_id=${REFRESH_SESSION_ID}` },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      hasSession: boolean;
      accessToken: string | null;
    };
    // まだ有効期限内のためセッションは維持される
    expect(body.hasSession).toBe(true);
    expect(body.accessToken).toBe("still-valid-access-token");

    // DB のセッションも残っている
    const rows = await db.select().from(sessions).where(eq(sessions.id, REFRESH_SESSION_ID));
    expect(rows.length).toBe(1);
  });

  // ── パラメータ化テスト ──
  describe.each([
    {
      description: "refreshToken なしで残り 100 秒（期限内だが 300 秒未満） → セッション維持",
      expiresOffset: 100,
      hasRefreshToken: false,
      expectedHasSession: true,
      shouldDeleteDb: false,
    },
    {
      description: "refreshToken なしで期限切れ（-10 秒） → セッション削除",
      expiresOffset: -10,
      hasRefreshToken: false,
      expectedHasSession: false,
      shouldDeleteDb: true,
    },
    {
      description: "expiresAt が null（無期限セッション扱い） → リフレッシュ不要でセッション維持",
      expiresOffset: null,
      hasRefreshToken: false,
      expectedHasSession: true,
      shouldDeleteDb: false,
    },
  ])(
    "パラメータ化テスト: $description",
    ({ expiresOffset, hasRefreshToken, expectedHasSession, shouldDeleteDb }) => {
      it(`検証: expectedHasSession=${expectedHasSession}`, async () => {
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = expiresOffset !== null ? now + expiresOffset : null;

        await db.insert(sessions).values({
          id: REFRESH_SESSION_ID,
          email: "param-test@example.com",
          accessToken: "param-access-token",
          refreshToken: hasRefreshToken ? "param-refresh-token" : null,
          expiresAt,
          createdAt: now - 1000,
        });

        const res = await defaultTestApp.request("/test", {
          headers: { Cookie: `session_id=${REFRESH_SESSION_ID}` },
        });

        expect(res.status).toBe(200);
        const body = (await res.json()) as { hasSession: boolean };
        expect(body.hasSession).toBe(expectedHasSession);

        const rows = await db.select().from(sessions).where(eq(sessions.id, REFRESH_SESSION_ID));
        expect(rows.length === 0).toBe(shouldDeleteDb);
      });
    }
  );
});
