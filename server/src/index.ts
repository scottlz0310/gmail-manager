import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { sessionMiddleware } from "./middleware/session";
import authRoutes from "./routes/auth";
import mailsRoutes from "./routes/mails";
import jobsRoutes from "./routes/jobs";

const app = new Hono();

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

app.use("*", logger());
app.use("*", cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use("*", sessionMiddleware);

app.route("/api/auth", authRoutes);
app.route("/api/mails", mailsRoutes);
app.route("/api/jobs", jobsRoutes);

app.get("/health", (c) => c.json({ ok: true }));

const PORT = Number(process.env.PORT ?? 3001);
console.log(`Server running on http://localhost:${PORT}`);

export default {
  port: PORT,
  fetch: app.fetch,
  idleTimeout: 0, // SSE の長時間接続を維持するためタイムアウトを無効化
};
