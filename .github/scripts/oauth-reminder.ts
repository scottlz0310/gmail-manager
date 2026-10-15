const ISSUE_MARKER = "<!-- gmail-manager-oauth-reminder -->";

interface Issue {
  number: number;
  body: string | null;
  pull_request?: unknown;
}

interface Comment {
  body: string | null;
}

export type Request = <T>(path: string, body?: Record<string, string>) => Promise<T>;

async function allPages<T>(request: Request, path: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const batch = await request<T[]>(`${path}&per_page=100&page=${page}`);
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}

export async function remind({
  request,
  repository,
  now,
  deadline = "不明（Google の警告メール・Cloud Console で確認してください）",
  runUrl,
}: {
  request: Request;
  repository: string;
  now: Date;
  deadline?: string;
  runUrl: string;
}): Promise<string> {
  const localDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const period = localDate.toISOString().slice(0, 7);
  const nextDate = new Date(Date.UTC(localDate.getUTCFullYear(), localDate.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
  const marker = `<!-- oauth-reminder:${period} -->`;
  const base = `/repos/${repository}/issues`;
  const issues = await allPages<Issue>(request, `${base}?state=all`);
  const issue = issues.find((item) => !item.pull_request && item.body?.includes(ISSUE_MARKER));
  const notification = `${marker}
@scottlz0310-user Gmail Manager の OAuth 利用状況を確認してください。

- 確認対象月：${period}（日本時間）
- Google の警告期限：${deadline}
- 次回確認日：${nextDate}（日本時間）
- 実行履歴：${runUrl}

Google の警告メールと Cloud Console で対象クライアント・実期限を確認し、必要ならローカルアプリで手動ログインしてください。実期限が次回確認日より早い場合は、その期限前に対応してください。
確認後は実施日・判明した期限・対応結果をこの Issue に記録してください。認証情報やメール内容は貼り付けないでください。
この通知自体は OAuth の利用実績を更新しません。`;

  if (!issue) {
    const created = await request<Issue>(base, {
      title: "OAuth 利用状況の定期確認",
      body: `${ISSUE_MARKER}\n# OAuth 利用状況の運用記録\n\nこの Issue を継続して使用します。通知を受け取るには Subscribe を確認してください。\n\n${notification}`,
    });
    return `運用 Issue #${created.number} を作成しました（${period}）。`;
  }

  const comments = await allPages<Comment>(
    request,
    `${base}/${issue.number}/comments?sort=created`
  );
  if (issue.body?.includes(marker) || comments.some((comment) => comment.body?.includes(marker))) {
    return `Issue #${issue.number} は ${period} の通知済みです。追加投稿を省略しました。`;
  }
  await request(`${base}/${issue.number}/comments`, { body: notification });
  return `Issue #${issue.number} に ${period} の確認通知を投稿しました。`;
}

if (import.meta.main) {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN;
  if (!repository || !token) throw new Error("GITHUB_REPOSITORY と GH_TOKEN が必要です。");
  const request: Request = async <T>(path: string, body?: Record<string, string>): Promise<T> => {
    const response = await fetch(`https://api.github.com${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      throw new Error(
        `OAuth リマインダーの GitHub API 呼び出し失敗: ${path} HTTP ${response.status}`
      );
    }
    return (await response.json()) as T;
  };
  const result = await remind({
    request,
    repository,
    now: new Date(),
    deadline: process.env.OAUTH_WARNING_DEADLINE || undefined,
    runUrl: `${process.env.GITHUB_SERVER_URL}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  });
  console.log(result);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${result}\n`);
  }
}
