# Gmail管理システム 設計ドキュメント（簡略案）

---

## 1. 結論

本システムは以下の方針で設計する：

- Gmail API を直接利用（GASは不採用）
- Hono + TypeScript をバックエンドの中核とする
- SQLite（`bun:sqlite`）をDB・状態管理に採用
- ORM は Drizzle ORM（SQLite ドライバ）を採用
- UI は Vite + React（軽量SPA）
- 進捗表示は SSE（Server-Sent Events）1本で完結
- Auth は Google OAuth 直接実装（外部Authサービス不要）
- 2層アーキテクチャ（Service + JobRunner）に絞る
- **Dockerなし・`bun install` だけで起動**

本ドキュメントは上位設計（Supabase構成）が重いと判断した場合の切替先として用意する。

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
  - WebUI（削除進捗をSSEでリアルタイム表示）

---

## 3. 非機能要件

- 冪等性（同一メールの多重処理防止）
- スケーラビリティ（ローカルツールのスコープ内）
- 可観測性（構造化ログ・状態追跡）
- 拡張性（将来の上位構成への移行路を確保）

---

## 4. 全体アーキテクチャ

```
[ Vite + React (SPA) ]
  ├ /src/App.tsx              ← WebUI (React)
  └ SSE接続 → /api/jobs/:id/stream
          ↓ fetch
[ Hono (Bun) ]
  ├ GET  /api/auth/google     ← OAuth開始
  ├ GET  /api/auth/callback   ← Googleコールバック
  ├ POST /api/mails/search    ← 検索API
  ├ POST /api/mails/delete    ← 削除ジョブ開始
  └ GET  /api/jobs/:id/stream ← SSEで進捗push
          ↓
[ SQLite（bun:sqlite）]
  ├ messages                  ← 処理状態管理
  └ sync_state                ← Gmail差分同期用 history_id
          ↓
[ Gmail API (Google) ]
```

---

## 5. 技術スタック

### 5.1 フロントエンド

- Vite + React + TypeScript
- TanStack Query（データフェッチ）
- shadcn/ui（UIコンポーネント）

### 5.2 バックエンド

- Hono（Bun上で動作）
- TypeScript

### 5.3 実行環境

- ローカルPC専用
- **Dockerなし**
- 起動: `bun run dev`（フロント・バック同時起動）

### 5.4 DB

- SQLite（`bun:sqlite`）
  - 採用理由: ファイル1枚・Dockerなし・起動ゼロコスト
  - DBファイル: `data/gmail-manager.db`

### 5.5 ORM

- Drizzle ORM（`drizzle-orm/bun-sqlite`）
  - 採用理由: 上位構成（PostgreSQL）への移行時にスキーマを流用可能

### 5.6 Auth

- Google OAuth 直接実装（`googleapis` パッケージ）
  - トークンはサーバーサイドセッション（Hono Cookie + SQLite）で管理
  - Supabase Auth を挟まないためシンプル

### 5.7 進捗表示

- SSE（Server-Sent Events）
  - Hono の `streamSSE` ヘルパーで実装
  - Supabase Realtime 相当の体験を外部依存なしで実現

---

## 6. データ設計

### 6.1 messages

```sql
messages (
  id            TEXT        PRIMARY KEY,   -- Gmail message ID
  thread_id     TEXT,
  labels        TEXT,                      -- JSONシリアライズ 例: '["INBOX","CATEGORY_PROMOTIONS"]'
  status        TEXT        NOT NULL,      -- 'pending' | 'deleted' | 'labeled' | 'failed'
  action        TEXT,                      -- 実行した操作 例: 'batchDelete' | 'addLabel'
  error_message TEXT,                      -- 失敗時のエラー内容
  processed_at  INTEGER                    -- Unix timestamp (SQLiteはTIMESTAMPTZなし)
)
```

### 6.2 sync_state

```sql
sync_state (
  key           TEXT        PRIMARY KEY,   -- 例: 'latest_history_id'
  value         TEXT        NOT NULL,
  updated_at    INTEGER
)
```

### 6.3 sessions

```sql
sessions (
  id            TEXT        PRIMARY KEY,   -- セッションID（Cookie値）
  access_token  TEXT        NOT NULL,
  refresh_token TEXT,
  expires_at    INTEGER,
  created_at    INTEGER
)
```

### 6.4 設計意図

- 上位構成の `messages` / `sync_state` テーブル構造をほぼ踏襲
- `labels` は SQLite の JSONB 非対応のため TEXT でシリアライズ
- `sessions` を自前管理することでSupabase Auth依存を排除
- 将来の PostgreSQL 移行時はスキーマ差分が最小になるよう設計

---

## 7. レイヤ設計

### 7.1 GmailService

責務：

- Gmail API との通信
- MailQuery の組み立て・実行

```typescript
interface MailQuery {
  category?: 'promotions' | 'social' | 'updates';
  olderThanDays?: number;
  isUnread?: boolean;
  label?: string;
}

interface GmailService {
  list(query: MailQuery): Promise<string[]>;
  batchDelete(ids: string[]): Promise<void>;
}
```

### 7.2 JobRunner

責務：

- chunk分割・進捗管理・エラーハンドリング・SSE通知
- DBへの状態記録

```typescript
interface JobRunner {
  run(jobId: string, ids: string[], onProgress: (done: number, total: number) => void): Promise<void>;
}
```

### 7.3 Honoルーター

責務：

- HTTPリクエスト受信・バリデーション
- GmailService / JobRunner の呼び出し
- SSEストリームの管理

---

## 8. 認証設計（OAuth）

### 8.1 フロー

```
1. ブラウザで WebUI を開く
2. 「Googleでログイン」ボタン → GET /api/auth/google
3. Google 同意画面（gmail.modify スコープを含む）
4. GET /api/auth/callback でコールバック受信
5. accessToken / refreshToken を sessions テーブルに保存
6. Cookie にセッションIDをセット
7. 以降のAPIリクエストはCookieからsessionを取得しaccessTokenをGmail APIへ渡す
```

### 8.2 必要なスコープ

```
https://www.googleapis.com/auth/gmail.modify
```

### 8.3 設定要件

- Google Cloud Console でのOAuthクライアント作成が必要
- `.env.local` に `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` を設定
- ローカル開発時は `http://localhost:3001/api/auth/callback` をリダイレクトURIに登録

### 8.4 注意点

- トークンリフレッシュは `googleapis` の `OAuth2Client` が自動処理
- Supabase Auth と比べてセッション管理が自前になるが、ローカルツールのスコープでは十分
- `access_token` をSQLiteに平文保存（ローカル専用前提）

---

## 9. 処理フロー

### 9.1 一括削除

```
1. WebUIで検索条件を入力
2. POST /api/mails/search → MailQuery を構築 → Gmail APIでメールID取得
3. POST /api/mails/delete → jobId を発行してJobRunner起動
4. GET /api/jobs/:id/stream（SSE接続）で進捗受信
5. JobRunner が chunk 500件単位でbatchDelete実行
6. SSEで進捗をWebUIにpush（done / total）
7. DBの messages テーブルに処理結果を記録（status: 'deleted' or 'failed'）
```

### 9.2 エラーハンドリング方針

```
- batchDelete が部分失敗した場合: 失敗IDを messages.status='failed' で記録
- quota超過 (429): exponential backoff（最大5回、上限60秒待機）
- 全失敗時: SSEでエラーイベント送信、DBにエラー内容保存
- 再実行時: status='failed' の ID のみ対象に絞る（冪等性担保）
```

### 9.3 差分同期（将来）

```
1. Gmail watch 登録
2. Pub/Sub 通知受信
3. history API で差分取得
4. sync_state の history_id を更新
```

※ Google Cloud の Pub/Sub 設定・ウェブフック受信サーバが必要なため、将来スコープとして保留。

---

## 10. レート制御

- chunk サイズ：500件（batchDelete 上限 1000件の半分で安全マージン）
- chunk 間インターバル：200ms
- quota 超過時：exponential backoff（初回1秒、最大60秒、最大5回）

上位構成と同一の制御ロジックを採用。将来移行時に変更不要。

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

- 上位構成（Supabase + Next.js）への移行（本ドキュメントの主目的）
- マルチアカウント対応
- スケジューラ（cron）による定期実行
- Gmail watch + Pub/Sub による差分同期
- 非同期ジョブ化（BullMQ 等）※ 処理件数増大時に検討

### 上位構成への移行パス

| 要素 | 本案 | 上位構成 | 移行コスト |
|------|------|----------|------------|
| DB | SQLite | PostgreSQL | スキーマほぼ流用・データ移行のみ |
| ORM | Drizzle（bun-sqlite） | Drizzle（pg） | ドライバ差し替えのみ |
| Auth | OAuth直実装 | Supabase Auth | 認証フロー書き換え |
| 進捗表示 | SSE | Supabase Realtime | SSE削除・Realtime追加 |
| サーバー | Hono | Next.js API Routes | ルーター書き換え |

---

## 13. リスク / 未決事項

| 項目 | 内容 | 対応方針 |
|------|------|----------|
| セッション管理 | access_token の平文保存 | ローカル専用前提で許容。SaaS化時は暗号化必須 |
| SSEの接続管理 | 長時間ジョブ中の切断 | クライアント側で再接続実装（EventSource 標準機能） |
| Gmail API quota | 超過時の挙動 | exponential backoff で対応（上位構成と同一） |
| watch + Pub/Sub | ローカルツールでの導入難易度 | 将来スコープとして保留 |

---

## 14. 次アクション

| # | アクション | 目的 |
|---|------------|------|
| 1 | GitHub に `gmail-manager` リポジトリ作成・clone | 作業環境準備 |
| 2 | `bun create hono` + Vite React プロジェクト作成 | 環境構築確認 |
| 3 | Google Cloud Console で OAuth クライアント作成・Gmail スコープ追加 | PoC前提条件 |
| 4 | `/api/auth/google` → callback → sessions保存 PoC | 認証フロー検証 |
| 5 | accessToken で `gmail.users.messages.list` を叩けるか確認 | PoC完了判定 |
| 6 | Drizzle ORM でスキーマ確定・マイグレーション | 実装着手 |

---

## 15. 補足

本設計は「Dockerなしで即起動できるローカルツール」を最優先とする。

過剰設計を避けつつ、以下を担保する：

- 境界の明確化（GmailService / JobRunner の2層）
- 依存関係の分離（DB・Auth・進捗表示がすべて自己完結）
- 上位構成への移行容易性（Drizzleスキーマ・レート制御・エラーハンドリングを共通化）

### 上位構成から削除した要素と理由

| 削除項目 | 理由 |
|----------|------|
| Supabase（PostgreSQL + Auth + Realtime） | Dockerが必要・起動コスト大・ローカルツールには過剰 |
| Next.js App Router | APIが2本のみ・Honoで十分 |
| 4層アーキテクチャ（UseCase / Service / Repository / Adapter） | 処理フローが単純・2層で可読性が高い |
| Supabase Realtime | SSEで同等体験を外部依存なしで実現可能 |

---
