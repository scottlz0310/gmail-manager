import { google } from "googleapis";

export interface MailQuery {
  category?: "promotions" | "social" | "updates";
  olderThanDays?: number;
  isUnread?: boolean;
  label?: string;
}

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;

export function buildQuery(query: MailQuery): string {
  const parts: string[] = [];
  if (query.category) parts.push(`category:${query.category}`);
  if (query.olderThanDays !== undefined) parts.push(`older_than:${query.olderThanDays}d`);
  if (query.isUnread !== undefined) parts.push(query.isUnread ? "is:unread" : "is:read");
  if (query.label) parts.push(`label:${query.label}`);
  return parts.join(" ");
}

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let backoff = INITIAL_BACKOFF_MS;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isQuota =
        err instanceof Error &&
        (err.message.includes("429") || err.message.includes("quotaExceeded"));
      if (!isQuota || attempt === MAX_RETRIES) throw err;
      await new Promise((r) => setTimeout(r, Math.min(backoff, 60_000)));
      backoff *= 2;
    }
  }
  throw new Error("unreachable");
}

export class GmailService {
  private readonly gmail;

  constructor(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    this.gmail = google.gmail({ version: "v1", auth });
  }

  async list(query: MailQuery): Promise<string[]> {
    const q = buildQuery(query);
    const ids: string[] = [];
    let pageToken: string | undefined;

    do {
      const res = await withRetry(() =>
        this.gmail.users.messages.list({ userId: "me", q, maxResults: 500, pageToken })
      );
      const messages = res.data.messages ?? [];
      ids.push(...messages.flatMap((m) => (m.id ? [m.id] : [])));
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return ids;
  }

  async batchDelete(ids: string[]): Promise<void> {
    await withRetry(() =>
      this.gmail.users.messages.batchDelete({ userId: "me", requestBody: { ids } })
    );
  }
}
