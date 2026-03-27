import { useState } from "react";

export interface SearchParams {
  category?: "promotions" | "social" | "updates";
  olderThanDays?: number;
  isUnread?: boolean;
  label?: string;
}

interface Props {
  onSearch: (params: SearchParams) => void;
  loading: boolean;
}

export default function SearchForm({ onSearch, loading }: Props) {
  const [category, setCategory] = useState<SearchParams["category"]>("promotions");
  const [olderThanDays, setOlderThanDays] = useState<number>(90);
  const [isUnread, setIsUnread] = useState<boolean | undefined>(undefined);
  const [label, setLabel] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      category: category || undefined,
      olderThanDays: olderThanDays || undefined,
      isUnread,
      label: label.trim() || undefined,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col gap-5"
    >
      <h2 className="font-semibold text-gray-800">検索条件</h2>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">カテゴリ</label>
        <select
          value={category ?? ""}
          onChange={(e) => setCategory((e.target.value as SearchParams["category"]) || undefined)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">指定なし</option>
          <option value="promotions">プロモーション</option>
          <option value="social">ソーシャル</option>
          <option value="updates">最新情報</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">
          〇日以上前のメール
        </label>
        <input
          type="number"
          min={1}
          value={olderThanDays}
          onChange={(e) => setOlderThanDays(Number(e.target.value))}
          placeholder="例: 90"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">既読 / 未読</label>
        <select
          value={isUnread === undefined ? "" : isUnread ? "unread" : "read"}
          onChange={(e) => {
            if (e.target.value === "") setIsUnread(undefined);
            else setIsUnread(e.target.value === "unread");
          }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">指定なし</option>
          <option value="read">既読のみ</option>
          <option value="unread">未読のみ</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">ラベル（任意）</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="例: newsletter"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium transition-colors"
      >
        {loading ? "検索中..." : "メールを検索"}
      </button>
    </form>
  );
}
