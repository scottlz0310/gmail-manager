import { eq } from "drizzle-orm";
import { deleteCookie, getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { db } from "../db";
import { sessions } from "../db/schema";
import { defaultTokenRefresher, type TokenRefresher } from "../services/googleAuth";

// API 呼び出し中の期限切れを防ぐため、有効期限の 5 分前（300 秒）からリフレッシュを試みる
export const REFRESH_MARGIN_SECONDS = 300;

export function createSessionMiddleware(tokenRefresher: TokenRefresher = defaultTokenRefresher) {
  return createMiddleware(async (c, next) => {
    const sessionId = getCookie(c, "session_id");
    if (sessionId) {
      const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
      if (session) {
        const now = Math.floor(Date.now() / 1000);
        const isExpired = session.expiresAt != null && session.expiresAt <= now;
        const isExpiringSoon =
          session.expiresAt != null && session.expiresAt <= now + REFRESH_MARGIN_SECONDS;

        if (isExpiringSoon) {
          if (session.refreshToken) {
            try {
              const refreshed = await tokenRefresher(session.refreshToken);
              const updated = {
                accessToken: refreshed.accessToken,
                refreshToken: refreshed.refreshToken ?? session.refreshToken,
                expiresAt: refreshed.expiresAt,
              };

              await db.update(sessions).set(updated).where(eq(sessions.id, sessionId));
              c.set("sessionId", session.id);
              c.set("session", { ...session, ...updated });
            } catch (err) {
              console.error(
                JSON.stringify({
                  action: "refreshToken",
                  sessionId,
                  error: err instanceof Error ? err.message : String(err),
                })
              );
              if (isExpired) {
                // 完全に期限切れかつリフレッシュ失敗時はセッション削除
                await db.delete(sessions).where(eq(sessions.id, sessionId));
                deleteCookie(c, "session_id", { path: "/" });
              } else {
                // 有効期限内（残り5分未満）の一時的失敗時は既存セッションを維持
                c.set("sessionId", session.id);
                c.set("session", session);
              }
            }
          } else if (isExpired) {
            // リフレッシュトークンがなく期限切れ: セッション削除
            await db.delete(sessions).where(eq(sessions.id, sessionId));
            deleteCookie(c, "session_id", { path: "/" });
          } else {
            // リフレッシュトークンはないが、まだ有効期限内
            c.set("sessionId", session.id);
            c.set("session", session);
          }
        } else {
          c.set("sessionId", session.id);
          c.set("session", session);
        }
      }
    }
    await next();
  });
}

export const sessionMiddleware = createSessionMiddleware();

export const requireAuth = createMiddleware(async (c, next) => {
  const session = c.get("session");
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  await next();
});
