import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { google } from "googleapis";
import { db } from "../db";
import { sessions } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const app = new Hono();

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3001/api/auth/callback"
  );
}

// id_token (JWT) のペイロードをデコードしてメールアドレスを取得
function extractEmailFromIdToken(idToken: string): string | null {
  try {
    const payload = idToken.split(".")[1];
    const decoded = Buffer.from(payload, "base64url").toString("utf-8");
    const claims = JSON.parse(decoded) as { email?: string };
    return claims.email ?? null;
  } catch {
    return null;
  }
}

// GET /api/auth/google → Google 同意画面へリダイレクト
app.get("/google", (c) => {
  const oauth2 = getOAuth2Client();
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    // email スコープを追加してメールアドレスを id_token に含める
    scope: ["https://mail.google.com/", "email"],
  });
  return c.redirect(url);
});

// GET /api/auth/callback → トークン取得・セッション保存
app.get("/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.json({ error: "missing code" }, 400);

  const oauth2 = getOAuth2Client();
  const { tokens } = await oauth2.getToken(code);

  if (!tokens.access_token) {
    return c.json({ error: "failed to get access token" }, 500);
  }

  // id_token からメールアドレスを取得（Google への追加リクエスト不要）
  const email = tokens.id_token ? extractEmailFromIdToken(tokens.id_token) : null;

  const sessionId = randomUUID();
  await db.insert(sessions).values({
    id: sessionId,
    email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : null,
    createdAt: Math.floor(Date.now() / 1000),
  });

  setCookie(c, "session_id", sessionId, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30日
  });

  return c.redirect(process.env.CLIENT_ORIGIN ?? "http://localhost:5173");
});

// POST /api/auth/logout → セッション削除
app.post("/logout", async (c) => {
  const sessionId = c.get("sessionId") as string | undefined;
  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    deleteCookie(c, "session_id", { path: "/" });
  }
  return c.json({ ok: true });
});

// GET /api/auth/me → ログイン状態確認（DB から返すだけ、Google API 呼び出しなし）
app.get("/me", (c) => {
  const session = c.get("session") as { email?: string | null } | undefined;
  if (!session) return c.json({ loggedIn: false });
  return c.json({ loggedIn: true, email: session.email ?? null });
});

export default app;
