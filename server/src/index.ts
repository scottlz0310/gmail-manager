import { resolve } from "node:path";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { sessionMiddleware } from "./middleware/session";
import authRoutes from "./routes/auth";
import jobsRoutes from "./routes/jobs";
import mailsRoutes from "./routes/mails";

const app = new Hono();

const PORT = Number(process.env.PORT ?? 3001);
const isProd = process.env.NODE_ENV === "production";

// GOOGLE_REDIRECT_URI のオリジンから CLIENT_ORIGIN を導出
// 例: http://localhost:3001/api/auth/callback → http://localhost:3001
function getDefaultClientOrigin(): string {
  const googleRedirect = process.env.GOOGLE_REDIRECT_URI;
  if (googleRedirect) {
    const match = /^(https?:\/\/[^/]+)/.exec(googleRedirect);
    if (match) return match[1];
  }
  return isProd ? `http://localhost:${PORT}` : "http://localhost:5173";
}

const CLIENT_ORIGIN = isProd
  ? getDefaultClientOrigin()
  : (process.env.CLIENT_ORIGIN ?? getDefaultClientOrigin());

app.use("*", logger());
app.use("*", cors({ origin: CLIENT_ORIGIN, credentials: true }));

// session middleware は API ルートのみに適用（静的アセットへの不要な DB ルックアップを回避）
app.use("/api/*", sessionMiddleware);

app.route("/api/auth", authRoutes);
app.route("/api/mails", mailsRoutes);
app.route("/api/jobs", jobsRoutes);

app.get("/health", (c) => c.json({ ok: true }));

const URL = `http://localhost:${PORT}`;

if (isProd) {
  const clientDist = resolve(import.meta.dir, "../../client/dist");
  app.use("/*", serveStatic({ root: clientDist }));
  // 存在しない API エンドポイントへの GET に HTML を返さないよう明示的に 404 を返す
  app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));
  app.get("*", () => new Response(Bun.file(resolve(clientDist, "index.html"))));

  setTimeout(() => {
    const cmd =
      process.platform === "win32"
        ? ["cmd", "/c", "start", "", URL]
        : process.platform === "darwin"
          ? ["open", URL]
          : ["xdg-open", URL];
    Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" });
  }, 500);
}

console.log(`Server running on ${URL}`);

export default {
  port: PORT,
  fetch: app.fetch,
  idleTimeout: 0, // SSE の長時間接続を維持するためタイムアウトを無効化
};
