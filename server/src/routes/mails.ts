import { Hono } from "hono";
import { requireAuth } from "../middleware/session";
import { GmailService } from "../services/GmailService";
import type { MailQuery } from "../services/GmailService";

const app = new Hono();

app.use("*", requireAuth);

// POST /api/mails/search → 検索条件でメール ID 一覧を返す
app.post("/search", async (c) => {
  const session = c.get("session") as { accessToken: string };
  const body = await c.req.json<MailQuery>();

  const gmail = new GmailService(session.accessToken);
  const ids = await gmail.list(body);

  return c.json({ ids, count: ids.length });
});

export default app;
