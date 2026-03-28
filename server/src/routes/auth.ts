import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { google } from "googleapis";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { db } from "../db";
import { sessions } from "../db/schema";
import type { HonoVariables } from "../types";

const app = new Hono<{ Variables: HonoVariables }>();

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID ?? "",
    process.env.GOOGLE_CLIENT_SECRET ?? "",
    process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3001/api/auth/callback"
  );
}

// HTTPS 環境かどうかでセキュア Cookie を切り替え
const isSecure = (process.env.GOOGLE_REDIRECT_URI ?? "").startsWith("https://");

// GET /api/auth/google → state を生成して Google 同意画面へリダイレクト
app.get("/google", (c) => {
  const state = randomUUID();
  setCookie(c, "oauth_state", state, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 10, // 10分
    secure: isSecure,
  });

  const oauth2 = getOAuth2Client();
  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://mail.google.com/", "email"],
    state,
  });
  return c.redirect(url);
});

// GET /api/auth/callback → state 検証・トークン取得・セッション保存
app.get("/callback", async (c) => {
  const code = c.req.query("code");
  const returnedState = c.req.query("state");
  const storedState = getCookie(c, "oauth_state");

  if (!code) return c.json({ error: "missing code" }, 400);

  // CSRF 防止: state 検証
  if (!returnedState || !storedState || returnedState !== storedState) {
    return c.json({ error: "invalid state" }, 400);
  }
  deleteCookie(c, "oauth_state", { path: "/" });

  const oauth2 = getOAuth2Client();
  const { tokens } = await oauth2.getToken(code);

  if (!tokens.access_token || !tokens.id_token) {
    return c.json({ error: "failed to get tokens" }, 500);
  }

  // id_token を署名検証してメールアドレスを取得
  const ticket = await oauth2.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID ?? "",
  });
  const email = ticket.getPayload()?.email ?? null;

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
    maxAge: 60 * 60 * 24 * 30,
    secure: isSecure,
  });

  const port = Number(process.env.PORT ?? 3001);
  const clientOrigin =
    process.env.NODE_ENV === "production"
      ? `http://localhost:${port}`
      : (process.env.CLIENT_ORIGIN ?? "http://localhost:5173");
  return c.redirect(clientOrigin);
});

// POST /api/auth/logout
app.post("/logout", async (c) => {
  const sessionId = c.get("sessionId") as string | undefined;
  if (sessionId) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    deleteCookie(c, "session_id", { path: "/" });
  }
  return c.json({ ok: true });
});

// GET /api/auth/me
app.get("/me", (c) => {
  const session = c.get("session") as { email?: string | null } | undefined;
  if (!session) return c.json({ loggedIn: false });
  return c.json({ loggedIn: true, email: session.email ?? null });
});

export default app;
