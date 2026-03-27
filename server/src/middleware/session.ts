import { createMiddleware } from "hono/factory";
import { getCookie, deleteCookie } from "hono/cookie";
import { db } from "../db";
import { sessions } from "../db/schema";
import { eq } from "drizzle-orm";

export const sessionMiddleware = createMiddleware(async (c, next) => {
  const sessionId = getCookie(c, "session_id");
  if (sessionId) {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
    if (session) {
      // 有効期限チェック
      const now = Math.floor(Date.now() / 1000);
      if (session.expiresAt && session.expiresAt < now) {
        // 期限切れ: DB から削除して Cookie をクリア → 再ログインを促す
        await db.delete(sessions).where(eq(sessions.id, sessionId));
        deleteCookie(c, "session_id", { path: "/" });
      } else {
        c.set("sessionId", session.id);
        c.set("session", session);
      }
    }
  }
  await next();
});

export const requireAuth = createMiddleware(async (c, next) => {
  const session = c.get("session");
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  await next();
});
