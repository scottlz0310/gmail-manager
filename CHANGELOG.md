# Changelog

## [Unreleased]

### Added

- **`src/app/dashboard/`**: ログイン後のダッシュボードページを追加（ユーザーメール表示・ログアウトボタン）
- **`src/app/LoginButton.tsx`**: ログインボタンを Client Component として分離（`signInWithOAuth` エラーハンドリング追加）

### Fixed

- **`src/app/page.tsx`**: Server Component 化してサーバ側でセッション判定し `redirect('/dashboard')` に変更（クライアント側ちらつき解消）
- **`src/app/LoginButton.tsx`**: OAuth スコープを `gmail.modify` から `https://mail.google.com/` に変更（`batchDelete` に必要な権限を付与）
- **`src/app/api/auth/callback/route.ts`**: ログイン成功後のリダイレクト先を `/` から `/dashboard` に変更
- **`src/app/dashboard/LogoutButton.tsx`**: `signOut` のエラーハンドリングと loading 状態を追加、`type="button"` を明示

- **`src/app/LoginButton.tsx`**: `redirectTo` をハードコードから `${location.origin}/api/auth/callback` に変更し、OAuth コールバック URL を統一
- **`src/app/auth/callback/page.tsx`**: `onAuthStateChange` のリスナーが unsubscribe されない問題を修正（`useEffect` の cleanup 関数で `subscription.unsubscribe()` を呼ぶよう変更）
- **`src/app/auth/callback/page.tsx`**: `SIGNED_IN` イベント待機前に `getSession()` で既存セッションを確認するよう修正（コールバックページで停止するケースを防止）
- **`src/app/api/mails/search/route.ts`**: `session.provider_token!` の非 null アサーションを削除し、token が存在しない場合は 401 を返すよう修正
- **`src/app/api/mails/delete/route.ts`**: `session.provider_token!` の非 null アサーションを削除し、token が存在しない場合は 401 とメッセージを返すよう修正
- **`src/app/api/auth/callback/route.ts`**: cookie 設定ロジックの重複を解消し、`createSupabaseServerClient` ヘルパーを再利用するよう変更
- **`supabase/config.toml`**: `site_url` を `http://localhost:3000` に統一し、`additional_redirect_urls` を `http://localhost:3000/api/auth/callback` に修正（Supabase の exact match 要件に対応）
- **`supabase/migrations/0000_loose_starfox.sql`**: `messages` / `sync_state` テーブルに RLS を有効化し、PUBLIC 権限を明示的に剥奪するよう追加
- **`src/lib/db/index.ts`**: `globalThis` を用いたシングルトンパターンで DB クライアントをキャッシュし、HMR 時のコネクション枯渇を防止
- **`docs/gmail-manager.md`**: OAuth コールバック URL の記載を `/api/auth/callback` に統一

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
