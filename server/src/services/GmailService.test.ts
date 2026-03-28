import { describe, expect, it, mock } from "bun:test";
import { buildQuery, withRetry } from "./GmailService";

// テスト用: バックオフ待機を即時解決するスタブ
const noopSleep = () => Promise.resolve();

// ─── buildQuery ───────────────────────────────────────────────────────────────

describe("buildQuery", () => {
  it("空のクエリは空文字列を返す", () => {
    expect(buildQuery({})).toBe("");
  });

  it("category のみ", () => {
    expect(buildQuery({ category: "promotions" })).toBe("category:promotions");
    expect(buildQuery({ category: "social" })).toBe("category:social");
    expect(buildQuery({ category: "updates" })).toBe("category:updates");
  });

  it("olderThanDays のみ", () => {
    expect(buildQuery({ olderThanDays: 30 })).toBe("older_than:30d");
    expect(buildQuery({ olderThanDays: 0 })).toBe("older_than:0d");
  });

  it("isUnread: true → is:unread", () => {
    expect(buildQuery({ isUnread: true })).toBe("is:unread");
  });

  it("isUnread: false → is:read", () => {
    expect(buildQuery({ isUnread: false })).toBe("is:read");
  });

  it("label のみ", () => {
    expect(buildQuery({ label: "work" })).toBe("label:work");
  });

  it("複数フィールドの組み合わせ", () => {
    expect(
      buildQuery({
        category: "promotions",
        olderThanDays: 30,
        isUnread: false,
        label: "test",
      })
    ).toBe("category:promotions older_than:30d is:read label:test");
  });

  it("isUnread が undefined のとき読既読フィルタを含まない", () => {
    const q = buildQuery({ category: "social" });
    expect(q).not.toContain("is:unread");
    expect(q).not.toContain("is:read");
  });
});

// ─── withRetry ────────────────────────────────────────────────────────────────

describe("withRetry", () => {
  it("初回で成功したときそのまま値を返す", async () => {
    const fn = mock(() => Promise.resolve(42));
    expect(await withRetry(fn, noopSleep)).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("429 エラーでリトライして成功する", async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      if (++calls < 3) throw new Error("429 Too Many Requests");
      return "ok";
    }, noopSleep);
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("quotaExceeded エラーでリトライして成功する", async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      if (++calls < 2) throw new Error("quotaExceeded");
      return "ok";
    }, noopSleep);
    expect(result).toBe("ok");
    expect(calls).toBe(2);
  });

  it("クォータ以外のエラーはリトライせず即座にスロー", async () => {
    const fn = mock(() => Promise.reject(new Error("network error")));
    await expect(withRetry(fn, noopSleep)).rejects.toThrow("network error");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("最大リトライ回数（5回）を超えたらスロー（計6回呼ばれる）", async () => {
    const fn = mock(() => Promise.reject(new Error("quotaExceeded")));
    await expect(withRetry(fn, noopSleep)).rejects.toThrow("quotaExceeded");
    expect(fn).toHaveBeenCalledTimes(6); // 初回 + 5リトライ
  });
});
