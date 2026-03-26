# Gmail管理システム 設計ドキュメント

---

## 1. 結論

本システムは以下の方針で設計する：

- Gmail API を直接利用（GASは不採用）
- Next.js (App Router) + TypeScript をフルスタックの中核とする
- Supabase（ローカル開発は `supabase local` / Docker）をDB・Auth・Realtimeに採用
- ORM は Drizzle ORM を採用
- UI は WebUI のみ（TUIフェーズは省略）
- Core ロジックと UI を完全分離したレイヤードアーキテクチャ
- 処理は同期APIで開始（非同期ジョブ化は将来判断）

本ドキュメントは確定仕様ではなく、拡張前提の設計たたき台とする。

---

## 2. 目的

### 2.1 主目的

- 肥大化したGmailの整理・最適化

### 2.2 機能要件

- 検索条件によるメール抽出
  - カテゴリ（Promotions / Social 等）
  - 期間（例：90日以上前）
  - 未読 / 既読
  - ラベル

- メール操作
  - 一括削除（batchDelete）
  - ラベル操作（付与 / 削除）

- 実行状態の可視化
  - WebUI（削除進捗をSupabase Realtimeでリアルタイム表示）

---

## 3. 非機能要件

- 冪等性（同一メールの多重処理防止）
- スケーラビリティ（将来的な並列処理対応）
- 可観測性（構造化ログ・状態追跡）
- 拡張性（UI・DB差し替え）

---

## 4. 全体アーキテクチャ

```
[ Next.js (App Router) ]
  ├ /app/page.tsx            ← WebUI (React)
  ├ /app/api/auth/callback   ← Google OAuth コールバック
  ├ /app/api/mails/search    ← 検索API
  └ /app/api/mails/delete    ← 削除API（同期・進捗はRealtime通知）
          ↓
[ Supabase ]
  ├ Auth (Google OAuth + Gmail scope)
  ├ PostgreSQL
  │   ├ messages    ← 処理状態管理
  │   └ sync_state  ← Gmail差分同期用 history_id
  └ Realtime        ← 削除進捗をWebUIにpush
          ↓
[ Gmail API (Google) ]
```

---

## 5. 技術スタック

### 5.1 フロントエンド / バックエンド

- Next.js (App Router)
- TypeScript
- React（UI）

### 5.2 実行環境

- ローカルPC専用
- 開発: `supabase start`（Docker）+ `next dev`
- 本番相当: `docker compose up`

### 5.3 DB / Auth / Realtime

- Supabase（PostgreSQL + Auth + Realtime）
- 開発環境: `supabase local`（Docker内包）
- 将来: Supabase Cloud への移行も可能

### 5.4 ORM

- Drizzle ORM
  - 採用理由: 軽量・TypeScript型安全性高・Docker環境でのバイナリ問題なし

### 5.5 UI

- Next.js App Router + React
- Supabase Realtime で削除進捗をリアルタイム表示

---

## 6. データ設計

### 6.1 messages

```sql
messages (
  id            TEXT        PRIMARY KEY,   -- Gmail message ID
  thread_id     TEXT,
  labels        JSONB,                     -- ラベルの配列 例: ["INBOX","CATEGORY_PROMOTIONS"]
  status        TEXT        NOT NULL,      -- 'pending' | 'deleted' | 'labeled' | 'failed'
  action        TEXT,                      -- 実行した操作 例: 'batchDelete' | 'addLabel'
  error_message TEXT,                      -- 失敗時のエラー内容
  processed_at  TIMESTAMPTZ
)
```

### 6.2 sync_state

```sql
sync_state (
  key           TEXT        PRIMARY KEY,   -- 例: 'latest_history_id'
  value         TEXT        NOT NULL,
  updated_at    TIMESTAMPTZ
)
```

### 6.3 設計意図

- `messages.status` で処理状態を明示管理（処理済みフラグだけでは不十分なため）
- `messages.error_message` で失敗原因を記録・再処理判断に使う
- `labels` は JSONB で保持（クエリ・更新が容易）
- `sync_state` は差分同期用の `history_id` を key/value 形式で保持（単純・拡張しやすい）

---

## 7. レイヤ設計

### 7.1 UseCase層

責務：

- 業務ロジック
- 処理フロー制御

例：

- `DeleteOldMailsUseCase`
- `CleanupPromotionsUseCase`

---

### 7.2 Service層

責務：

- 外部API抽象化（Gmail API）

インターフェース：

```typescript
interface MailQuery {
  category?: 'promotions' | 'social' | 'updates';
  olderThanDays?: number;
  isUnread?: boolean;
  label?: string;
}

interface MailService {
  list(query: MailQuery): Promise<string[]>;
  batchDelete(ids: string[]): Promise<void>;
}
```

`MailQuery` を構造化することで UseCase 層でのクエリ組み立て責任を明確化する。

---

### 7.3 Repository層

責務：

- DBアクセス抽象化（Drizzle ORM経由）

---

### 7.4 Adapter層

- Gmail API 実装
- Supabase クライアント実装

---

## 8. 認証設計（OAuth）

### 8.1 フロー

```
1. ブラウザで WebUI を開く
2. 「Googleでログイン」ボタン → Supabase Auth が Google OAuth を開始
3. Google 同意画面（gmail.modify スコープを含む）
4. /app/api/auth/callback でコールバック受信
5. Supabase Auth がトークン管理（リフレッシュ自動）
6. バックエンドAPIは Supabase セッションから accessToken を取得して Gmail API へ渡す
```

### 8.2 必要なスコープ

```
https://www.googleapis.com/auth/gmail.modify
```

### 8.3 設定要件

- Google Cloud Console でのOAuthクライアント作成が必要
- Supabase ダッシュボード（または `supabase/config.toml`）で Google プロバイダを設定
- Supabase Auth の Google OAuth は `gmail.modify` スコープを追加設定することで対応

### 8.4 注意点

- Supabase Auth 単体ではなく、Google Cloud Console 側の設定も必須
- accessToken をバックエンドで受け取り Gmail API に渡す実装が別途必要（「丸投げ」にはならない）
- ローカル開発時は `http://localhost:3000/auth/callback` をリダイレクトURIに登録

---

## 9. 処理フロー

### 9.1 一括削除

```
1. WebUIで検索条件を入力
2. /api/mails/search → MailQuery を構築 → Gmail APIでメールID取得
3. 取得IDをchunk分割（500件単位）
4. batchDelete 実行
5. Supabase Realtime で進捗をWebUIにpush
6. DBの messages テーブルに処理結果を記録（status: 'deleted' or 'failed'）
```

### 9.2 エラーハンドリング方針

```
- batchDelete が部分失敗した場合: 失敗IDを messages.status='failed' で記録
- quota超過 (429): exponential backoff（最大5回、上限60秒待機）
- 全失敗時: WebUIにエラー表示、DBにエラー内容保存
- 再実行時: status='failed' の ID のみ対象に絞る（冪等性担保）
```

### 9.3 差分同期（将来）

```
1. Gmail watch 登録
2. Pub/Sub 通知受信
3. history API で差分取得
4. sync_state の history_id を更新
```

※ Google Cloud の Pub/Sub 設定・ウェブフック受信サーバが必要なため、ローカルツールのスコープ外として将来検討。

---

## 10. レート制御

- chunk サイズ：500件（batchDelete 上限 1000件の半分で安全マージン）
- chunk 間インターバル：200ms
- quota 超過時：exponential backoff（初回1秒、最大60秒、最大5回）

### 参考：GASとの処理速度比較

```
GAS実績:         700〜800件 / 5分（約150件/分）
Gmail API理論値: 最大50件/秒（quota: 250 units/秒、batchDelete = 5 units/件）
→ 同等処理を 15〜30秒 で完了見込み（約20倍高速）
→ 同期APIで十分。非同期ジョブ（BullMQ等）は現時点では不採用。
```

---

## 11. ログ設計

- 構造化ログ（JSON形式）

例：

```json
{
  "action": "batchDelete",
  "count": 500,
  "status": "success",
  "duration_ms": 1240
}
```

```json
{
  "action": "batchDelete",
  "count": 10,
  "status": "failed",
  "error": "quotaExceeded",
  "retry": 2
}
```

---

## 12. 将来拡張

- マルチアカウント対応
- スケジューラ（cron）による定期実行
- Gmail watch + Pub/Sub による差分同期
- 非同期ジョブ化（BullMQ 等）※ 処理件数増大時に検討
- Supabase Cloud へのデプロイ（SaaS化）

---

## 13. リスク / 未決事項

| 項目                         | 内容                               | 対応方針                   |
| ---------------------------- | ---------------------------------- | -------------------------- |
| Supabase Auth × Gmail scope  | accessToken 取得方法の詳細         | PoC で確認（論点3）        |
| Gmail API quota              | 超過時の挙動                       | exponential backoff で対応 |
| watch + Pub/Sub              | ローカルツールでの導入難易度       | 将来スコープとして保留     |

---

## 14. 次アクション

| #  | アクション                                                         | 目的           |
| -- | ------------------------------------------------------------------ | -------------- |
| 1  | GitHub に `gmail-manager` リポジトリ作成・clone                    | 作業環境準備   |
| 2  | `supabase start` + Next.js プロジェクト作成                        | 環境構築確認   |
| 3  | Google Cloud Console で OAuth クライアント作成・Gmail スコープ追加 | PoC前提条件    |
| 4  | Supabase Auth で Google OAuth → Gmail accessToken 取得 PoC         | 認証フロー検証 |
| 5  | accessToken で `gmail.users.messages.list` を叩けるか確認          | PoC完了判定    |
| 6  | Drizzle ORM でスキーマ確定・マイグレーション                       | 実装着手       |

---

## 15. 補足

本設計は「ローカルツールとして開始し、段階的に拡張する」ことを前提とする。

過剰設計を避けつつ、以下を担保する：

- 境界の明確化
- 依存関係の分離
- 将来の置き換え容易性

### 廃止した選択肢と理由

| 廃止項目                      | 理由                                                   |
| ----------------------------- | ------------------------------------------------------ |
| GAS                           | Gmail API 直接利用の方が高速・柔軟                     |
| SQLite                        | Supabase採用でPostgreSQL移行コスト不要に               |
| TUIフェーズ（ink / blessed）  | WebUI一本化でシンプル化。`blessed` はメンテナンス停止  |
| 非同期ジョブ（BullMQ）        | 同期APIで十分な処理速度（GAS比20倍）                   |
| Prisma                        | Drizzle ORM の方がDocker環境・軽量ツールに適合         |

---
