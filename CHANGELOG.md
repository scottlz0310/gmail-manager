# Changelog

## [Unreleased]

### 追加

- OAuth セッションの有効期限間近（残り5分未満）でのリフレッシュトークンによるアクセストークン自動更新を追加（#143）。Google OAuth2 クライアントを DI 可能な構成とし、トークンローテーション・失効・一時エラー時のセッション維持をテスト。
- 無人運用・最小権限の設計方針（CI に認証情報を配置しないセキュリティ境界、常駐バッチ環境の要件、`batchDelete` と `gmail.modify` のトレードオフ）を `docs/gmail-manager.md` に明文化（#143）。
- OAuth 利用確認を毎月 GitHub の運用 Issue で通知する workflow と手動実行・同月の重複投稿防止を追加（#142）。Google の認証情報を CI に保存せず、期限不明時の確認手順と実行履歴を整備。
- リマインダーの通知先は Organization 名ではなく担当ユーザー `@scottlz0310-user` を指定。

### 変更

- Biome を 2.6.3 へ更新して設定を移行し、Markdown・YAML の検査を維持する。lefthook の対象を biome.json とそろえ、pre-push で lint・型検査・サーバーとリマインダーのテストを全体実行する。
- ルートの型検査が直接使う TypeScript を devDependencies に明示し、workspace 内の間接的な配置に依存しないようにした。採用済みの版は維持する。
- `.gitattributes` でテキストを LF に統一し、Windows の `core.autocrlf=true` の新規 clone でも未変更ファイルが pre-push の整形違反にならないようにした。

- OAuth2 クライアント生成およびトークン更新ロジックを `server/src/services/googleAuth.ts` にモジュール化・共通化（#143）。
- 自分用のローカル利用・BYO クライアント・External/Testing 継続の OAuth 運用方針を明文化（#147）。同意画面とテストユーザーの設定、完全削除権限、トークン失効時の再ログインを README に追記し、初期設計の OAuth 節を現行実装に合わせて修正。

## [0.2.0] - 2026-03-27

### Changed

- **アーキテクチャを全面刷新**（Next.js/Supabase → Hono + Bun + Vite + SQLite）
  - Docker 不要・`bun install` だけで起動できるローカルツールに最適化
  - 4層アーキテクチャ（UseCase / Service / Repository / Adapter）を廃止し、2層（GmailService / JobRunner）に簡素化
  - Supabase Auth を廃止し、Google OAuth を `googleapis` で直実装
  - PostgreSQL + Supabase Realtime を廃止し、SQLite（bun:sqlite）+ SSE に置き換え

### Added

- **`server/src/services/JobRunner.ts`**: chunk 分割・進捗管理・SSE 通知・DB 記録を一元管理
- **`server/src/routes/jobs.ts`**: `GET /api/jobs/:id/stream` SSE エンドポイント（削除進捗をリアルタイム push）
- **`server/src/db/index.ts`**: 起動時に `CREATE TABLE IF NOT EXISTS` でテーブル自動作成（マイグレーション不要）
- **`client/src/components/DeleteProgress.tsx`**: SSE で進捗バーをリアルタイム更新
- 削除完了画面に実行時間（秒）・処理速度（件/秒）を表示
- Biome（lint / format）・lefthook（pre-commit フック）・GitHub Actions（CI / Release）を追加

### Fixed

- Bun のデフォルト `idleTimeout`（10秒）による SSE 切断を `idleTimeout: 0` で解消
- `/api/auth/me` が `https://mail.google.com/` スコープのみでは Google userinfo API に 401 を返す問題を修正（`email` スコープ追加・`id_token` からメールアドレスを取得）
- SSE `done` イベントに `durationMs` が含まれていなかった問題を修正

## [0.1.0] - 2026-03-26

### Added

- Next.js 15 (App Router + TypeScript + Tailwind CSS) プロジェクト初期構築
- Supabase ローカル開発環境設定（Auth + PostgreSQL + Realtime）
- Drizzle ORM スキーマ定義（`messages`、`sync_state` テーブル）
- レイヤードアーキテクチャ実装骨格（UseCase / Service / Repository / Adapter）
- Google OAuth フロー設定（`supabase/config.toml`）
- Gmail API アダプタ（検索・batchDelete + リトライ）
- メール検索・削除 API ルート（`/api/mails/search`、`/api/mails/delete`）
- 設計ドキュメント（`docs/gmail-manager.md`）
