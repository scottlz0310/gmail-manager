import { useState } from "react";
import DeleteProgress from "./DeleteProgress";
import SearchForm, { type SearchParams } from "./SearchForm";
import ThemeToggle from "./ThemeToggle";

interface Props {
  email: string;
  onLogout: () => void;
}

type Phase =
  | { type: "idle" }
  | { type: "searching" }
  | { type: "preview"; count: number; ids: string[]; query: SearchParams }
  | { type: "deleting"; jobId: string; total: number }
  | { type: "done"; done: number; failed: number; durationMs: number };

export default function Dashboard({ email, onLogout }: Props) {
  const [phase, setPhase] = useState<Phase>({ type: "idle" });
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleSearch = async (params: SearchParams) => {
    setPhase({ type: "searching" });
    const res = await fetch("/api/mails/search", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      setPhase({ type: "idle" });
      alert(`検索に失敗しました: ${data.error}`);
      return;
    }
    setPhase({ type: "preview", count: data.count, ids: data.ids, query: params });
  };

  const handleDelete = async (ids: string[], query: SearchParams) => {
    const res = await fetch("/api/jobs", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(`削除ジョブの開始に失敗しました: ${data.error}`);
      return;
    }
    setPhase({ type: "deleting", jobId: data.jobId, total: ids.length });
  };

  const handleLogout = async () => {
    setLogoutError(null);
    const res = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    if (!res.ok) {
      setLogoutError("ログアウトに失敗しました。再度お試しください。");
      return;
    }
    onLogout();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Gmail Manager</h1>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <span className="text-sm text-gray-500 dark:text-gray-400">{email}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
          >
            ログアウト
          </button>
        </div>
      </header>
      {logoutError && (
        <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          {logoutError}
        </div>
      )}

      <main className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-6">
        {(phase.type === "idle" || phase.type === "searching") && (
          <SearchForm onSearch={handleSearch} loading={phase.type === "searching"} />
        )}

        {phase.type === "preview" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col gap-4">
            <p className="text-gray-700 dark:text-gray-200">
              <span className="font-semibold text-xl text-gray-900 dark:text-gray-100">
                {phase.count}
              </span>{" "}
              件が検索条件に一致しました。
            </p>
            {phase.count === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                削除対象のメールがありません。
              </p>
            ) : (
              <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                削除すると元に戻せません。本当に削除しますか？
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPhase({ type: "idle" })}
                className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                キャンセル
              </button>
              {phase.count > 0 && (
                <button
                  type="button"
                  onClick={() => handleDelete(phase.ids, phase.query)}
                  className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
                >
                  {phase.count} 件を削除
                </button>
              )}
            </div>
          </div>
        )}

        {phase.type === "deleting" && (
          <DeleteProgress
            jobId={phase.jobId}
            total={phase.total}
            onDone={(done, failed, durationMs) =>
              setPhase({ type: "done", done, failed, durationMs })
            }
          />
        )}

        {phase.type === "done" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col gap-4">
            <p className="text-gray-800 dark:text-gray-100 font-semibold text-lg">完了しました</p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              削除成功: <span className="font-medium text-green-600">{phase.done} 件</span>
              {phase.failed > 0 && (
                <>
                  　/ 失敗: <span className="font-medium text-red-500">{phase.failed} 件</span>
                </>
              )}
            </p>
            {phase.durationMs > 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                実行時間: {(phase.durationMs / 1000).toFixed(1)} 秒 （
                {Math.round(phase.done / (phase.durationMs / 1000))} 件/秒）
              </p>
            )}
            <button
              type="button"
              onClick={() => setPhase({ type: "idle" })}
              className="py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
            >
              最初に戻る
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
