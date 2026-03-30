import { useEffect, useState } from "react";

interface Props {
  jobId: string;
  total: number;
  onDone: (done: number, failed: number, durationMs: number) => void;
}

export default function DeleteProgress({ jobId, total, onDone }: Props) {
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/jobs/${jobId}/stream`, { withCredentials: true });

    es.addEventListener("progress", (e) => {
      const data = JSON.parse(e.data) as { done: number; total: number; failed: number };
      setDone(data.done);
      setFailed(data.failed);
    });

    es.addEventListener("done", (e) => {
      const data = JSON.parse(e.data) as { done: number; failed: number; durationMs: number };
      es.close();
      onDone(data.done, data.failed, data.durationMs);
    });

    es.addEventListener("error", (e) => {
      const msgEvent = e as MessageEvent;
      if (msgEvent.data) {
        const data = JSON.parse(msgEvent.data) as { message: string };
        setError(data.message);
      } else {
        setError("接続エラーが発生しました。");
      }
      es.close();
    });

    return () => es.close();
  }, [jobId, onDone]);

  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 flex flex-col gap-4">
      <p className="font-semibold text-gray-800 dark:text-gray-100">削除中...</p>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
          エラー: {error}
        </p>
      ) : (
        <>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className="bg-blue-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 text-right">
            {done} / {total} 件
            {failed > 0 && (
              <span className="ml-2 text-red-500 dark:text-red-400">（失敗: {failed} 件）</span>
            )}
          </p>
        </>
      )}
    </div>
  );
}
