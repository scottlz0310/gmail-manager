import { describe, expect, it } from "bun:test";
import { getJob, subscribeJob } from "./JobRunner";

// ─── getJob ───────────────────────────────────────────────────────────────────

describe("getJob", () => {
  it("存在しない ID は undefined を返す", () => {
    expect(getJob("nonexistent-id")).toBeUndefined();
  });
});

// ─── subscribeJob ─────────────────────────────────────────────────────────────

describe("subscribeJob", () => {
  it("存在しない ID に subscribe しても関数が返る（呼び出してもエラーにならない）", () => {
    const unsubscribe = subscribeJob("nonexistent-id", () => {});
    expect(typeof unsubscribe).toBe("function");
    expect(() => unsubscribe()).not.toThrow();
  });

  it("listener は呼ばれない（ジョブが存在しないため）", () => {
    let called = false;
    subscribeJob("nonexistent-id", () => {
      called = true;
    });
    expect(called).toBe(false);
  });
});
