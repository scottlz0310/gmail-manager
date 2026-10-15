import { describe, expect, it } from "bun:test";
import { type Request, remind } from "./oauth-reminder";

const issueMarker = "<!-- gmail-manager-oauth-reminder -->";
const options = {
  repository: "scottlz0310/gmail-manager",
  now: new Date("2026-10-15T00:00:00Z"),
  runUrl: "https://github.com/scottlz0310/gmail-manager/actions/runs/1",
};

function mockRequest(responses: unknown[]) {
  const calls: { path: string; body?: Record<string, string> }[] = [];
  const request: Request = async <T>(path: string, body?: Record<string, string>) => {
    calls.push({ path, body });
    if (!responses.length) throw new Error(`想定外の API 呼び出し: ${path}`);
    return responses.shift() as T;
  };
  return { request, calls };
}

describe("OAuth 利用確認リマインダー", () => {
  it("初回に運用 Issue を作成し、不明な期限と次回確認日を記載する", async () => {
    const { request, calls } = mockRequest([[], { number: 200 }]);
    await remind({ ...options, request });
    expect(calls[1].body?.body).toContain("Google の警告期限：不明");
    expect(calls[1].body?.body).toContain("次回確認日：2026-11-01");
    expect(calls[1].body?.body).toContain("@scottlz0310");
  });

  it.each(["body", "comment"])("%s に当月通知があれば再投稿しない", async (location) => {
    const marker = "<!-- oauth-reminder:2026-10 -->";
    const { request, calls } = mockRequest([
      [{ number: 200, body: `${issueMarker}${location === "body" ? marker : ""}` }],
      location === "comment" ? [{ body: marker }] : [],
    ]);
    expect(await remind({ ...options, request })).toContain("通知済み");
    expect(calls.every((call) => !call.body)).toBe(true);
  });

  it.each([
    ["2026-10-31T15:00:00Z", "2026-11", "2026-12-01"],
    ["2026-12-31T15:00:00Z", "2027-01", "2027-02-01"],
  ])("日本時間の月境界と年越しを扱う: %s", async (date, period, nextDate) => {
    const { request, calls } = mockRequest([[{ number: 200, body: issueMarker }], [], {}]);
    await remind({ ...options, request, now: new Date(date), deadline: "2027-02-15" });
    expect(calls[2].body?.body).toContain(`oauth-reminder:${period}`);
    expect(calls[2].body?.body).toContain(`次回確認日：${nextDate}`);
    expect(calls[2].body?.body).toContain("Google の警告期限：2027-02-15");
  });

  it("Issue・コメントの2ページ目も確認して重複通知を防ぐ", async () => {
    const { request, calls } = mockRequest([
      Array.from({ length: 100 }, (_, number) => ({ number, body: "通常の Issue" })),
      [{ number: 200, body: issueMarker }],
      Array.from({ length: 100 }, () => ({ body: "過去の確認記録" })),
      [{ body: "<!-- oauth-reminder:2026-10 -->" }],
    ]);
    expect(await remind({ ...options, request })).toContain("通知済み");
    expect(calls[1].path).toContain("page=2");
    expect(calls[3].path).toContain("page=2");
    expect(calls.every((call) => !call.body)).toBe(true);
  });

  it("通知 API の失敗を成功扱いにしない", async () => {
    const { request: read } = mockRequest([[{ number: 200, body: issueMarker }], []]);
    const request: Request = (path, body) => {
      if (body) throw new Error("GitHub API HTTP 403");
      return read(path);
    };
    await expect(remind({ ...options, request })).rejects.toThrow("GitHub API HTTP 403");
  });
});
