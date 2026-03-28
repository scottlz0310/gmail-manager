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
// 本番モードはクライアントとサーバーが同一オリジンなので PORT に合わせる
const CLIENT_ORIGIN = isProd
  ? `http://localhost:${PORT}`
  : (process.env.CLIENT_ORIGIN ?? "http://localhost:5173");

app.use("*", logger());
app.use("*", cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use("*", sessionMiddleware);

app.route("/api/auth", authRoutes);
app.route("/api/mails", mailsRoutes);
app.route("/api/jobs", jobsRoutes);

app.get("/health", (c) => c.json({ ok: true }));

const URL = `http://localhost:${PORT}`;

if (isProd) {
  const clientDist = resolve(import.meta.dir, "../../client/dist");
  app.use("/*", serveStatic({ root: clientDist }));
  app.get("*", () => new Response(Bun.file(resolve(clientDist, "index.html"))));

  // ビルド完了後にブラウザを自動で開く
  setTimeout(() => {
    const cmd =
      process.platform === "win32"
        ? ["cmd", "/c", "start", "", URL]
        : process.platform === "darwin"
          ? ["open", URL]
          : ["xdg-open", URL];
    Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  }, 500);
}

console.log(`Server running on ${URL}`);

export default {
  port: PORT,
  fetch: app.fetch,
  idleTimeout: 0, // SSE の長時間接続を維持するためタイムアウトを無効化
};
