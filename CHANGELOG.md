# Changelog

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
