import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { db } from "../db";
import { sessions } from "../db/schema";
import { eq } from "drizzle-orm";

// セッション情報をコンテキストにセット（全ルート共通）
export const sessionMiddleware = createMiddleware(async (c, next) => {
  const sessionId = getCookie(c, "session_id");
  if (sessionId) {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
    if (session) {
      c.set("sessionId", session.id);
      c.set("session", session);
    }
  }
  await next();
});

// 認証必須ルート用ガード
export const requireAuth = createMiddleware(async (c, next) => {
  const session = c.get("session");
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  await next();
});
