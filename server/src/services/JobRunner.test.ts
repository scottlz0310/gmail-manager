import { afterEach, describe, expect, it, mock } from "bun:test";
import { randomUUID } from "node:crypto";
import type { JobEvent } from "./JobRunner";

// ─── GmailService モック ───────────────────────────────────────────────────────
// var で宣言することで Bun のホイスティング後もファクトリ内代入が可能。
// ファクトリはモジュールインポート時に遅延実行されるため、
// インスタンスメソッドからの参照は問題なく動作する。
var gmailConfig: { shouldThrow: boolean; listResult: string[] };

mock.module("./GmailService", () => {
  gmailConfig = { shouldThrow: false, listResult: ["msg-1", "msg-2"] };
  return {
    GmailService: class MockGmailService {
      async list(_query: unknown): Promise<string[]> {
        if (gmailConfig.shouldThrow) throw new Error("Gmail API error");
        return gmailConfig.listResult;
      }
      async batchDelete(_ids: string[]): Promise<void> {}
    },
  };
});

import { getJob, startJob, subscribeJob } from "./JobRunner";

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

// ─── startJob ─────────────────────────────────────────────────────────────────

/** ジョブが done または error になるまで待機するヘルパー */
function waitForJobEvent(jobId: string): Promise<JobEvent> {
  return new Promise<JobEvent>((resolve, reject) => {
    // let で先に初期化しておくことで、既完了ジョブへの即時通知（microtask）で
    // unsub() が呼ばれる際に TDZ エラーにならないようにする
    let unsub = () => {};
    const timer = setTimeout(() => {
      unsub();
      reject(new Error("job event timeout"));
    }, 5000);
    unsub = subscribeJob(jobId, (event) => {
      if (event.type === "done" || event.type === "error") {
        clearTimeout(timer);
        unsub();
        resolve(event);
      }
    });
  });
}

describe("startJob", () => {
  afterEach(() => {
    gmailConfig.shouldThrow = false;
    gmailConfig.listResult = ["msg-1", "msg-2"];
  });

  it("ジョブがレジストリに登録される", async () => {
    const jobId = randomUUID();
    await startJob(jobId, "test-token", {});
    expect(getJob(jobId)).toBeDefined();
    await waitForJobEvent(jobId);
  });

  it("正常完了: pending → running → done に遷移し done イベントが発火する", async () => {
    const jobId = randomUUID();
    await startJob(jobId, "test-token", { category: "promotions" });

    const event = await waitForJobEvent(jobId);
    expect(event.type).toBe("done");

    const job = getJob(jobId);
    expect(job?.status).toBe("done");
    expect(job?.total).toBe(2);
    expect(job?.done).toBe(2);
    expect(job?.failed).toBe(0);
  });

  it("gmail.list エラー → failed 状態に遷移し error イベントが発火する", async () => {
    gmailConfig.shouldThrow = true;

    const jobId = randomUUID();
    await startJob(jobId, "test-token", {});

    const event = await waitForJobEvent(jobId);
    expect(event.type).toBe("error");
    if (event.type === "error") {
      expect(event.message).toBe("Gmail API error");
    }

    const job = getJob(jobId);
    expect(job?.status).toBe("failed");
  });

  it("既完了ジョブへの subscribeJob は即時 done イベントを発火する", async () => {
    const jobId = randomUUID();
    await startJob(jobId, "test-token", {});
    await waitForJobEvent(jobId);

    // 既に done 状態のジョブへの subscribe → Promise.resolve で即時通知される
    const secondEvent = await new Promise<JobEvent>((resolve, reject) => {
      let unsub = () => {};
      const timer = setTimeout(() => {
        unsub();
        reject(new Error("immediate notification timeout"));
      }, 1000);
      unsub = subscribeJob(jobId, (event) => {
        clearTimeout(timer);
        unsub();
        resolve(event);
      });
    });
    expect(secondEvent.type).toBe("done");
  });
});
